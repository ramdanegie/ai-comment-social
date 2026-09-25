import crypto from 'node:crypto';
import { Elysia, t } from 'elysia';
import { node } from '@elysiajs/node';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { db, schema } from '@replyra/db';
import { eq, desc, and, sql, ilike, inArray } from 'drizzle-orm';
import { ReplyPolicyEvaluator, normalizeBrandVoice } from './contexts/response/domain/ReplyPolicyEvaluator';
import { aiStatus, classifyComment, draftReply } from './contexts/moderation/application/AiModeration';
import { encryptToken, verifyMetaSignature } from './shared/infrastructure/crypto';
import { enqueueJob } from './contexts/engagement/application/MetaIngestion';
import {
  buildInstagramAuthUrl,
  connectInstagramAccount,
  exchangeInstagramCode,
  verifyState
} from './contexts/channel/application/ConnectInstagram';
import {
  createCheckout,
  getBillingStatus,
  listPublicPricing,
  startTrial,
  syncPayment,
  verifyMidtransSignature as verifyBillingSignature
} from './contexts/billing/application/Billing';
import { RegistrationError, ensureTenantWorkspace, registerTenant } from './contexts/identity/application/Accounts';
import { adminRoutes } from './contexts/billing/presentation/adminRoutes';
import { auth } from './shared/infrastructure/auth';
import { authGuard } from './shared/http/authGuard';
import { dailyTrend, medianResponseSec, topPosts } from './contexts/insights/application/Metrics';
import { buildFacebookAuthUrl, connectFacebookPages, exchangeFacebookCode } from './contexts/channel/application/ConnectFacebook';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3099;

const WEB_ORIGINS = (process.env.WEB_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
/** Public web app URL (Midtrans finish redirect). */
/** Sign-up throttle: 5 per IP per hour (in-memory; one API process on shared hosting). */
const signupHits = new Map<string, number[]>();
function allowSignup(ip: string) {
  const now = Date.now();
  const hits = (signupHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= 5) return false;
  hits.push(now);
  signupHits.set(ip, hits);
  return true;
}

const WEB_URL = (process.env.WEB_URL || WEB_ORIGINS[0] || 'http://localhost:5173').replace(/\/$/, '');

/** Plan limit on connected social accounts; returns an error message when `adding` would exceed it. */
async function accountLimitError(workspaceId: string, adding: number) {
  const billing = await getBillingStatus(workspaceId);
  if (!billing?.plan) return null;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.socialAccounts)
    .where(eq(schema.socialAccounts.workspaceId, workspaceId));
  if ((row?.n ?? 0) + adding <= billing.plan.maxSocialAccounts) return null;
  return `Paket ${billing.plan.name} maksimal ${billing.plan.maxSocialAccounts} akun. Upgrade paket untuk menambah akun.`;
}

// Bun locally/VPS; Node on cPanel shared hosting (Passenger) — see src/node/*.
export const app = new Elysia(typeof Bun === 'undefined' ? { adapter: node() } : {})
  .use(
    cors({
      origin: WEB_ORIGINS,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['set-auth-token']
    })
  )
  // Better Auth: /api/auth/sign-in/email, /sign-out, /get-session, ...
  .all('/api/auth/*', ({ request, set }) => {
    if (request.method !== 'GET' && request.method !== 'POST') {
      set.status = 405;
      return 'Method Not Allowed';
    }
    return auth.handler(request);
  })
  .use(authGuard)
  .use(adminRoutes)
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Replyra API — AI Comment Management',
          version: '1.0.0',
          description: 'SaaS Multi-tenant AI Comment Moderation & Auto-Reply for MauJahit.id and brands'
        }
      }
    })
  )
  // Health
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'replyra-api',
    runtime: 'bun'
  }))

  // Public SaaS sign-up → user (owner) + workspace on a trial (Shadow mode, PRD decision 6).
  .post(
    '/api/v1/register',
    async ({ body, request, set }) => {
      const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
      if (!allowSignup(ip)) {
        set.status = 429;
        return { error: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.' };
      }
      try {
        const { workspace } = await registerTenant(body);
        return { success: true, workspace: { slug: workspace.slug, name: workspace.name } };
      } catch (err) {
        if (err instanceof RegistrationError) {
          set.status = 400;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2, maxLength: 80 }),
        email: t.String({ format: 'email', maxLength: 160 }),
        password: t.String({ minLength: 10, maxLength: 200 }),
        brandName: t.String({ minLength: 2, maxLength: 80 })
      })
    }
  )

  // Google sign-in lands here (Better Auth callbackURL, same origin → session cookie present).
  // First-time Google users become tenant owners on a trial; the session token is handed to the
  // web app in the URL fragment (never sent to a server) because the web app uses bearer auth.
  .get('/api/v1/auth/social-done', async ({ request, redirect }) => {
    const s = await auth.api.getSession({ headers: request.headers });
    if (!s) return redirect(`${WEB_URL}/login?error=google`);
    const user = s.user as typeof s.user & { isSuperadmin?: boolean };
    if (!user.isSuperadmin) await ensureTenantWorkspace(user);
    return redirect(`${WEB_URL}/login#token=${encodeURIComponent(s.session.token)}`);
  })

  // Signed-in user + their workspaces/roles (replaces the old demo login endpoints)
  .get('/api/v1/me', async ({ session }) => {
    const rows = await db
      .select({
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        slug: schema.workspaces.slug,
        role: schema.memberships.role
      })
      .from(schema.memberships)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
      .where(eq(schema.memberships.userId, session!.user.id));
    return { user: session!.user, workspaces: rows };
  })

  // 1. Workspaces
  .get('/api/v1/workspaces', async ({ session }) => {
    // Only workspaces the caller belongs to (tenant isolation).
    return db
      .select({
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        slug: schema.workspaces.slug,
        createdAt: schema.workspaces.createdAt,
        role: schema.memberships.role
      })
      .from(schema.memberships)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
      .where(eq(schema.memberships.userId, session!.user.id))
      .orderBy(desc(schema.workspaces.createdAt));
  })

  .post(
    '/api/v1/workspaces',
    async ({ body, session }) => {
      const slug = body.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const [ws] = await db
        .insert(schema.workspaces)
        .values({
          name: body.name,
          slug
        })
        .returning();

      await startTrial(ws.id);

      // Creator becomes owner.
      await db.insert(schema.memberships).values({ workspaceId: ws.id, userId: session!.user.id, role: 'owner' });

      return ws;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 })
      })
    }
  )

  // Workspace Members from Database
  .get('/api/v1/workspaces/:ws/members', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const members = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        role: schema.memberships.role,
        createdAt: schema.users.createdAt
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.workspaceId, ws.id));

    return members;
  })

  // Invite/add Member to Database
  .post(
    '/api/v1/workspaces/:ws/members',
    async ({ session, params, body }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      const email = body.email.trim().toLowerCase();
      let user = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
      });

      if (!user) {
        const id = `usr_${email.split('@')[0]}_${Date.now().toString(36)}`;
        const [newUser] = await db
          .insert(schema.users)
          .values({
            id,
            email,
            name: body.name || email.split('@')[0]
          })
          .returning();
        user = newUser;
      }

      await db
        .insert(schema.memberships)
        .values({
          workspaceId: ws.id,
          userId: user.id,
          role: body.role as any
        })
        .onConflictDoUpdate({
          target: [schema.memberships.workspaceId, schema.memberships.userId],
          set: { role: body.role as any }
        });

      await db.insert(schema.auditLogs).values({
        workspaceId: ws.id,
        actor: user.id,
        action: 'membership.created',
        targetType: 'membership',
        targetId: user.id,
        meta: { email, role: body.role }
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: body.role,
        createdAt: user.createdAt
      };
    },
    {
      body: t.Object({
        email: t.String(),
        role: t.String(),
        name: t.Optional(t.String())
      })
    }
  )

  // 2. Social Accounts
  .get('/api/v1/workspaces/:ws/accounts', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) return [];
    const accounts = await db.query.socialAccounts.findMany({
      where: eq(schema.socialAccounts.workspaceId, ws.id),
      with: {
        // replies / policies can be attached
      }
    });

    // attach policy
    const accountsWithPolicy = await Promise.all(
      accounts.map(async (acc) => {
        const policy = await db.query.replyPolicies.findFirst({
          where: eq(schema.replyPolicies.socialAccountId, acc.id)
        });
        return {
          ...acc,
          accessTokenEnc: undefined, // Never leak encrypted token in API
          policy
        };
      })
    );
    return accountsWithPolicy;
  })

  // Instagram Login (no Facebook Page): step 1 — URL for the "Hubungkan Instagram" button
  .get('/api/v1/workspaces/:ws/accounts/connect/instagram', async ({ session, params, set }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) {
      set.status = 404;
      return { error: 'Workspace not found' };
    }
    try {
      return buildInstagramAuthUrl(ws.slug);
    } catch (err) {
      set.status = 500;
      return { error: (err as Error).message };
    }
  })

  // Step 2 — exchange the ?code from the redirect, connect the account, poll immediately
  .post(
    '/api/v1/workspaces/:ws/accounts/connect/instagram',
    async ({ session, params, body, set }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }
      try {
        // State is required on the redirect flow; manual paste may omit it (user-initiated, same session).
        if (body.state && verifyState(body.state) !== ws.slug) throw new Error('OAuth state belongs to another workspace');

        const { token, expiresAt } = await exchangeInstagramCode(body.code);

        const limit = await accountLimitError(ws.id, 1);
        if (limit) {
          set.status = 402;
          return { error: limit };
        }

        const account = await connectInstagramAccount(ws.id, token, expiresAt);

        await db.insert(schema.auditLogs).values({
          workspaceId: ws.id,
          actor: session?.user.id ?? 'unknown',
          action: 'account.connected',
          targetType: 'social_account',
          targetId: account.id,
          meta: { platform: 'instagram', username: account.username, via: 'instagram_login' }
        });
        await enqueueJob('poll_account', { accountId: account.id });

        return { success: true, account: { ...account, accessTokenEnc: undefined } };
      } catch (err) {
        set.status = 400;
        return { error: (err as Error).message };
      }
    },
    { body: t.Object({ code: t.String({ minLength: 10 }), state: t.Optional(t.String()) }) }
  )

  // Facebook Pages: step 1 — Facebook Login URL for the "Hubungkan Facebook" button
  .get('/api/v1/workspaces/:ws/accounts/connect/facebook', ({ workspace, set }) => {
    try {
      return buildFacebookAuthUrl(workspace!.slug);
    } catch (err) {
      set.status = 500;
      return { error: (err as Error).message };
    }
  })

  // Step 2 — exchange ?code, return the Pages to choose from (+ encrypted ticket holding their tokens)
  .post(
    '/api/v1/workspaces/:ws/accounts/connect/facebook',
    async ({ workspace, body, set }) => {
      try {
        if (verifyState(body.state) !== workspace!.slug) throw new Error('OAuth state belongs to another workspace');
        return await exchangeFacebookCode(workspace!.slug, body.code);
      } catch (err) {
        set.status = 400;
        return { error: (err as Error).message };
      }
    },
    { body: t.Object({ code: t.String({ minLength: 10 }), state: t.String() }) }
  )

  // Step 3 — connect the chosen Pages, poll immediately
  .post(
    '/api/v1/workspaces/:ws/accounts/connect/facebook/pages',
    async ({ workspace, session, body, set }) => {
      const ws = workspace!;
      const limit = await accountLimitError(ws.id, body.pageIds.length);
      if (limit) {
        set.status = 402;
        return { error: limit };
      }
      try {
        const accounts = await connectFacebookPages(ws.id, ws.slug, body.ticket, body.pageIds);
        for (const account of accounts) {
          await db.insert(schema.auditLogs).values({
            workspaceId: ws.id,
            actor: session?.user.id ?? 'unknown',
            action: 'account.connected',
            targetType: 'social_account',
            targetId: account.id,
            meta: { platform: 'facebook', page: account.username, via: 'facebook_login' }
          });
          await enqueueJob('poll_account', { accountId: account.id });
        }
        return { success: true, accounts: accounts.map((a) => ({ ...a, accessTokenEnc: undefined })) };
      } catch (err) {
        set.status = 400;
        return { error: (err as Error).message };
      }
    },
    { body: t.Object({ ticket: t.String(), pageIds: t.Array(t.String(), { minItems: 1, maxItems: 50 }) }) }
  )

  .delete('/api/v1/workspaces/:ws/accounts/:id', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    await db.delete(schema.socialAccounts).where(
      and(eq(schema.socialAccounts.id, params.id as any), eq(schema.socialAccounts.workspaceId, ws.id))
    );

    await db.insert(schema.auditLogs).values({
      workspaceId: ws.id,
      actor: session?.user.id ?? 'unknown',
      action: 'account.disconnected',
      targetType: 'social_account',
      targetId: params.id,
      meta: { timestamp: new Date() }
    });

    return { success: true };
  })

  // Trigger an immediate poll (dev mode has no comment webhooks)
  .post('/api/v1/workspaces/:ws/accounts/:id/sync', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');
    const acc = await db.query.socialAccounts.findFirst({
      where: and(eq(schema.socialAccounts.id, params.id as any), eq(schema.socialAccounts.workspaceId, ws.id))
    });
    if (!acc) throw new Error('Account not found');
    await enqueueJob('poll_account', { accountId: acc.id });
    return { success: true, queued: true };
  })

  // 3. Comments (List, Filter, Search, Detail, Label Correction)
  .get('/api/v1/workspaces/:ws/comments', async ({ session, params, query }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) return { items: [], total: 0 };

    const conditions = [eq(schema.comments.workspaceId, ws.id)];

    if (query.status) {
      conditions.push(eq(schema.comments.status, query.status as any));
    }
    if (query.platform) {
      conditions.push(eq(schema.comments.platform, query.platform as any));
    }

    const rawList = await db
      .select({
        comment: schema.comments,
        classification: schema.classifications,
        reply: schema.replies,
        post: schema.posts,
        account: schema.socialAccounts
      })
      .from(schema.comments)
      .leftJoin(schema.classifications, eq(schema.comments.id, schema.classifications.commentId))
      .leftJoin(schema.replies, eq(schema.comments.id, schema.replies.commentId))
      .leftJoin(schema.posts, eq(schema.comments.postId, schema.posts.id))
      .leftJoin(schema.socialAccounts, eq(schema.comments.socialAccountId, schema.socialAccounts.id))
      .where(and(...conditions))
      .orderBy(desc(schema.comments.commentedAt));

    let filtered = rawList;

    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.comment.text.toLowerCase().includes(s) ||
          (item.comment.authorName && item.comment.authorName.toLowerCase().includes(s))
      );
    }

    if (query.sentiment) {
      filtered = filtered.filter((item) => item.classification?.sentiment === query.sentiment);
    }

    if (query.risk) {
      if (query.risk === 'risk') {
        filtered = filtered.filter((item) => ['toxic', 'hate', 'threat', 'sensitive'].includes(item.classification?.riskLabel || ''));
      } else if (query.risk === 'none') {
        filtered = filtered.filter((item) => item.classification?.riskLabel === 'none');
      } else {
        filtered = filtered.filter((item) => item.classification?.riskLabel === query.risk);
      }
    }

    return {
      items: filtered.map((row) => ({
        ...row.comment,
        classification: row.classification,
        reply: row.reply,
        post: row.post,
        account: row.account ? { username: row.account.username, platform: row.account.platform } : null
      })),
      total: filtered.length
    };
  })

  .get('/api/v1/workspaces/:ws/comments/:id', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const comment = await db.query.comments.findFirst({
      where: and(eq(schema.comments.id, params.id as any), eq(schema.comments.workspaceId, ws.id))
    });
    if (!comment) throw new Error('Comment not found');

    const classification = await db.query.classifications.findFirst({
      where: eq(schema.classifications.commentId, comment.id)
    });
    const reply = await db.query.replies.findFirst({
      where: eq(schema.replies.commentId, comment.id)
    });
    const post = comment.postId
      ? await db.query.posts.findFirst({ where: eq(schema.posts.id, comment.postId) })
      : null;

    const audits = await db.query.auditLogs.findMany({
      where: and(eq(schema.auditLogs.workspaceId, ws.id), eq(schema.auditLogs.targetId, comment.id)),
      orderBy: [desc(schema.auditLogs.createdAt)]
    });

    return {
      ...comment,
      classification,
      reply,
      post,
      auditHistory: audits
    };
  })

  // F13: Label correction by human
  .patch(
    '/api/v1/workspaces/:ws/comments/:id/label',
    async ({ session, params, body }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      const classification = await db.query.classifications.findFirst({
        where: eq(schema.classifications.commentId, params.id as any)
      });
      if (!classification) throw new Error('Classification not found');

      await db
        .update(schema.classifications)
        .set({
          humanSentiment: body.sentiment as any,
          humanRiskLabel: body.riskLabel as any,
          correctedBy: 'user'
        })
        .where(eq(schema.classifications.id, classification.id));

      await db.insert(schema.auditLogs).values({
        workspaceId: ws.id,
        actor: session?.user.id ?? 'unknown',
        action: 'label.corrected',
        targetType: 'comment',
        targetId: params.id,
        meta: { previous: classification.riskLabel, corrected: body.riskLabel }
      });

      return { success: true };
    },
    {
      body: t.Object({
        sentiment: t.String(),
        riskLabel: t.String()
      })
    }
  )

  // 4. Review Queue (PRD §8, §10)
  .get('/api/v1/workspaces/:ws/review', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) return [];

    const queue = await db
      .select({
        comment: schema.comments,
        classification: schema.classifications,
        reply: schema.replies,
        post: schema.posts,
        account: schema.socialAccounts
      })
      .from(schema.comments)
      .leftJoin(schema.classifications, eq(schema.comments.id, schema.classifications.commentId))
      .leftJoin(schema.replies, eq(schema.comments.id, schema.replies.commentId))
      .leftJoin(schema.posts, eq(schema.comments.postId, schema.posts.id))
      .leftJoin(schema.socialAccounts, eq(schema.comments.socialAccountId, schema.socialAccounts.id))
      .where(
        and(
          eq(schema.comments.workspaceId, ws.id),
          eq(schema.comments.status, 'NEEDS_REVIEW')
        )
      )
      .orderBy(desc(schema.comments.commentedAt));

    // Sort risk items first: threat > hate > toxic > sensitive > spam > none
    const riskRank: Record<string, number> = {
      threat: 6,
      hate: 5,
      toxic: 4,
      sensitive: 3,
      spam: 2,
      none: 1
    };

    return queue
      .map((item) => ({
        ...item.comment,
        classification: item.classification,
        reply: item.reply,
        post: item.post,
        account: item.account ? { username: item.account.username, platform: item.account.platform } : null
      }))
      .sort((a, b) => {
        const rankA = riskRank[a.classification?.riskLabel || 'none'] || 0;
        const rankB = riskRank[b.classification?.riskLabel || 'none'] || 0;
        return rankB - rankA;
      });
  })

  // Approve draft (shortcut A)
  .post(
    '/api/v1/workspaces/:ws/review/:commentId/approve',
    async ({ session, params, body, set }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      const existingReply = await db.query.replies.findFirst({
        where: eq(schema.replies.commentId, params.commentId as any)
      });

      const replyText = body?.text || existingReply?.draftText || 'Terima kasih atas pesan Anda!';
      const edited = !!body?.text && body.text !== existingReply?.draftText;
      const source = edited ? 'human_written' : 'human_approved';

      const comment = await db.query.comments.findFirst({
        where: and(eq(schema.comments.id, params.commentId as any), eq(schema.comments.workspaceId, ws.id))
      });
      if (!comment) throw new Error('Comment not found');

      const blocked = await publishBlockedReason(ws.id);
      if (blocked) {
        set.status = 402;
        return { error: blocked };
      }

      if (existingReply?.externalReplyId) {
        return { success: true, status: 'REPLIED' }; // invariant §4.3-3: one reply per comment
      }

      if (existingReply) {
        await db
          .update(schema.replies)
          .set({ finalText: replyText, source, error: null })
          .where(eq(schema.replies.id, existingReply.id));
      } else {
        await db.insert(schema.replies).values({
          commentId: comment.id,
          draftText: replyText,
          finalText: replyText,
          source
        });
      }

      // Meta: send via worker (PRD §3.4). Other platforms are not integrated yet → mark replied locally.
      const isMeta = comment.platform === 'instagram' || comment.platform === 'facebook';
      const status = isMeta ? 'APPROVED' : 'REPLIED';
      await db.update(schema.comments).set({ status }).where(eq(schema.comments.id, comment.id));
      if (isMeta) await enqueueJob('send_reply', { commentId: comment.id });

      await db.insert(schema.auditLogs).values({
        workspaceId: ws.id,
        actor: session?.user.id ?? 'unknown',
        action: 'reply.approved',
        targetType: 'comment',
        targetId: params.commentId,
        meta: { finalText: replyText, source }
      });

      return { success: true, status };
    },
    {
      body: t.Optional(
        t.Object({
          text: t.Optional(t.String())
        })
      )
    }
  )

  // Regenerate draft (shortcut R)
  .post('/api/v1/workspaces/:ws/review/:commentId/regenerate', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const comment = await db.query.comments.findFirst({
      where: and(eq(schema.comments.id, params.commentId as any), eq(schema.comments.workspaceId, ws.id))
    });
    if (!comment) throw new Error('Comment not found');

    const policy = await db.query.replyPolicies.findFirst({
      where: eq(schema.replyPolicies.socialAccountId, comment.socialAccountId)
    });

    const classification = await db.query.classifications.findFirst({
      where: eq(schema.classifications.commentId, comment.id)
    });

    const post = comment.postId ? await db.query.posts.findFirst({ where: eq(schema.posts.id, comment.postId) }) : null;
    const brandVoice = normalizeBrandVoice(policy?.brandVoice, ws.name);

    const { text: newDraft } = await draftReply({
      workspaceId: ws.id,
      commentId: comment.id,
      input: {
        commentText: comment.text,
        authorName: comment.authorName,
        postCaption: post?.caption ?? null,
        classification: {
          sentiment: classification?.sentiment ?? 'neutral',
          riskLabel: classification?.riskLabel ?? 'none',
          intent: classification?.intent ?? 'other'
        },
        brandVoice
      }
    });

    await db
      .update(schema.replies)
      .set({ draftText: newDraft })
      .where(eq(schema.replies.commentId, comment.id));

    return { success: true, draftText: newDraft };
  })

  // Hide comment (shortcut H)
  .post('/api/v1/workspaces/:ws/review/:commentId/hide', async ({ session, params, set }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');
    const blocked = await publishBlockedReason(ws.id);
    if (blocked) {
      set.status = 402;
      return { error: blocked };
    }

    const comment = await db.query.comments.findFirst({
      where: and(eq(schema.comments.id, params.commentId as any), eq(schema.comments.workspaceId, ws.id))
    });
    if (!comment) throw new Error('Comment not found');

    // Meta: worker hides on the platform, then sets HIDDEN. Other platforms: local status only.
    if (comment.platform === 'instagram' || comment.platform === 'facebook') {
      await enqueueJob('hide_comment', { commentId: comment.id, hide: true });
    } else {
      await db.update(schema.comments).set({ status: 'HIDDEN' }).where(eq(schema.comments.id, comment.id));
    }

    await db.insert(schema.auditLogs).values({
      workspaceId: ws.id,
      actor: session?.user.id ?? 'unknown',
      action: 'comment.hide_requested',
      targetType: 'comment',
      targetId: params.commentId,
      meta: { timestamp: new Date() }
    });

    return { success: true, status: 'HIDDEN' };
  })

  // Dismiss comment (shortcut D)
  .post('/api/v1/workspaces/:ws/review/:commentId/dismiss', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    await db
      .update(schema.comments)
      .set({ status: 'DISMISSED' })
      .where(eq(schema.comments.id, params.commentId as any));

    await db.insert(schema.auditLogs).values({
      workspaceId: ws.id,
      actor: session?.user.id ?? 'unknown',
      action: 'comment.dismissed',
      targetType: 'comment',
      targetId: params.commentId,
      meta: { timestamp: new Date() }
    });

    return { success: true, status: 'DISMISSED' };
  })

  // 5. Reply Policy GET / PUT / Preview
  .get('/api/v1/workspaces/:ws/accounts/:id/policy', async ({ session, params, workspace, set }) => {
    const account = await db.query.socialAccounts.findFirst({
      where: and(eq(schema.socialAccounts.id, params.id as any), eq(schema.socialAccounts.workspaceId, workspace!.id))
    });
    if (!account) {
      set.status = 404;
      return { error: 'Account not found' };
    }
    const policy = await db.query.replyPolicies.findFirst({
      where: eq(schema.replyPolicies.socialAccountId, params.id as any)
    });
    return policy;
  })

  .put(
    '/api/v1/workspaces/:ws/accounts/:id/policy',
    async ({ session, params, body, membership, set }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      // Tenant scoping: the account must belong to this workspace.
      const account = await db.query.socialAccounts.findFirst({
        where: and(eq(schema.socialAccounts.id, params.id as any), eq(schema.socialAccounts.workspaceId, ws.id))
      });
      if (!account) {
        set.status = 404;
        return { error: 'Account not found' };
      }
      if (body.mode === 'auto' && membership?.role !== 'owner') {
        set.status = 403;
        return { error: 'Hanya owner yang boleh mengaktifkan mode Auto' };
      }
      if (body.mode !== 'shadow') {
        const blocked = await publishBlockedReason(ws.id);
        if (blocked) {
          set.status = 402;
          return { error: blocked };
        }
      }

      const [updated] = await db
        .update(schema.replyPolicies)
        .set({
          mode: body.mode,
          autoReplyIntents: body.autoReplyIntents as any,
          minConfidence: body.minConfidence,
          dailyAutoReplyLimit: body.dailyAutoReplyLimit,
          minIntervalSeconds: body.minIntervalSeconds,
          brandVoice: normalizeBrandVoice(body.brandVoice, ws.name),
          customBlockedKeywords: body.customBlockedKeywords ?? [],
          autoHideSpam: body.autoHideSpam
        })
        .where(eq(schema.replyPolicies.socialAccountId, params.id as any))
        .returning();

      await db.insert(schema.auditLogs).values({
        workspaceId: ws.id,
        actor: session?.user.id ?? 'unknown',
        action: 'policy.updated',
        targetType: 'reply_policy',
        targetId: params.id,
        meta: { mode: body.mode, minConfidence: body.minConfidence }
      });

      return updated;
    },
    {
      body: t.Object({
        mode: t.String(),
        autoReplyIntents: t.Array(t.String()),
        minConfidence: t.Number(),
        dailyAutoReplyLimit: t.Number(),
        minIntervalSeconds: t.Number(),
        brandVoice: t.Any(),
        customBlockedKeywords: t.Nullable(t.Array(t.String())),
        autoHideSpam: t.Boolean()
      })
    }
  )

  // Policy live preview tester
  .post(
    '/api/v1/workspaces/:ws/accounts/:id/policy/preview',
    async ({ body, workspace }) => {
      const bv = normalizeBrandVoice(body.brandVoice, workspace!.name);
      const postCaption = body.samplePostCaption?.trim() || null;

      const t0 = performance.now();
      const classification = await classifyComment({
        workspaceId: workspace!.id,
        commentId: null,
        text: body.sampleComment,
        postCaption,
        brandName: bv.brandName,
        customKeywords: body.customBlockedKeywords || []
      });

      const t1 = performance.now();
      const { text: draft, model: draftModel } = await draftReply({
        workspaceId: workspace!.id,
        commentId: null,
        input: {
          commentText: body.sampleComment,
          authorName: body.sampleAuthor || 'Kakak',
          postCaption,
          classification,
          brandVoice: bv
        }
      });

      const t2 = performance.now();
      const decision = ReplyPolicyEvaluator.evaluate(
        classification,
        {
          mode: body.mode as any,
          autoReplyIntents: body.autoReplyIntents,
          minConfidence: body.minConfidence,
          dailyAutoReplyLimit: 200,
          minIntervalSeconds: 20,
          brandVoice: bv,
          autoHideSpam: body.autoHideSpam
        }
      );

      const postCheck = ReplyPolicyEvaluator.postCheckReply(draft, bv);

      return {
        classification,
        draft,
        decision,
        postCheck,
        ai: {
          ...(await aiStatus(workspace!.id)),
          classifyModel: classification.model,
          draftModel,
          timingMs: { classify: Math.round(t1 - t0), draft: Math.round(t2 - t1) }
        }
      };
    },
    {
      body: t.Object({
        sampleComment: t.String(),
        sampleAuthor: t.Optional(t.Nullable(t.String())),
        samplePostCaption: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
        mode: t.String(),
        autoReplyIntents: t.Array(t.String()),
        minConfidence: t.Number(),
        brandVoice: t.Any(),
        customBlockedKeywords: t.Optional(t.Nullable(t.Array(t.String()))),
        autoHideSpam: t.Boolean()
      })
    }
  )

  // 6. Dashboard Summary & Trends (PRD §5.1 FR-6, §10)
  .get('/api/v1/workspaces/:ws/dashboard/summary', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const allComments = await db.query.comments.findMany({
      where: eq(schema.comments.workspaceId, ws.id)
    });

    const commentIds = allComments.map((c) => c.id);
    let classifications: any[] = [];
    if (commentIds.length > 0) {
      classifications = await db.query.classifications.findMany({
        where: inArray(schema.classifications.commentId, commentIds)
      });
    }

    const total = allComments.length;
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let risk = 0;
    let spam = 0;

    for (const cl of classifications) {
      if (['toxic', 'hate', 'threat', 'sensitive'].includes(cl.riskLabel)) {
        risk++;
      } else if (cl.riskLabel === 'spam') {
        spam++;
      } else if (cl.sentiment === 'positive') {
        positive++;
      } else if (cl.sentiment === 'negative') {
        negative++;
      } else {
        neutral++;
      }
    }

    const autoReplied = allComments.filter((c) => c.status === 'REPLIED').length;
    const needsReview = allComments.filter((c) => c.status === 'NEEDS_REVIEW').length;
    const queued = allComments.filter((c) => c.status === 'AUTO_REPLY_QUEUED').length;
    const hidden = allComments.filter((c) => c.status === 'HIDDEN').length;

    return {
      total,
      positive,
      neutral,
      negative,
      risk,
      spam,
      aiActivity: {
        autoReplied,
        needsReview,
        queued,
        hidden
      },
      medianResponseSec: await medianResponseSec(ws.id),
      responseTimeText: '6 Menit (Rata-rata)'
    };
  })

  .get('/api/v1/workspaces/:ws/dashboard/trend', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) return [];

    return dailyTrend(ws.id, 14);
  })

  // 7. Reports & CSV Export (PRD §5.1 FR-7)
  .get('/api/v1/workspaces/:ws/reports', async ({ session, params, query }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const days = query.period === 'weekly' ? 28 : 14;
    const [metrics, posts] = await Promise.all([dailyTrend(ws.id, days), topPosts(ws.id, days)]);
    return { period: query.period || 'daily', metrics: [...metrics].reverse(), topPosts: posts };
  })

  .get('/api/v1/workspaces/:ws/reports/export.csv', async ({ session, params, set }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const list = await db
      .select({
        id: schema.comments.id,
        platform: schema.comments.platform,
        author: schema.comments.authorName,
        text: schema.comments.text,
        date: schema.comments.commentedAt,
        status: schema.comments.status,
        sentiment: schema.classifications.sentiment,
        risk: schema.classifications.riskLabel,
        intent: schema.classifications.intent,
        reply: schema.replies.finalText
      })
      .from(schema.comments)
      .leftJoin(schema.classifications, eq(schema.comments.id, schema.classifications.commentId))
      .leftJoin(schema.replies, eq(schema.comments.id, schema.replies.commentId))
      .where(eq(schema.comments.workspaceId, ws.id));

    let csv = 'ID,Platform,Author,Comment,Date,Status,Sentiment,Risk,Intent,Reply\n';
    for (const r of list) {
      const cleanText = `"${(r.text || '').replace(/"/g, '""')}"`;
      const cleanReply = `"${(r.reply || '').replace(/"/g, '""')}"`;
      csv += `${r.id},${r.platform},${r.author || ''},${cleanText},${r.date?.toISOString()},${r.status},${r.sentiment || ''},${r.risk || ''},${r.intent || ''},${cleanReply}\n`;
    }

    set.headers['Content-Type'] = 'text/csv; charset=utf-8';
    set.headers['Content-Disposition'] = `attachment; filename="replyra-report-${ws.slug}.csv"`;
    return csv;
  })

  // 8. Billing & Plans (PRD §5.1 FR-9, §3.5) — prices come from the DB (set by superadmin)
  .get('/api/v1/plans', async () => (await listPublicPricing()).plans)
  .get('/api/v1/pricing', () => listPublicPricing())

  .get('/api/v1/workspaces/:ws/billing', async ({ workspace }) => {
    const [status, payments] = await Promise.all([
      getBillingStatus(workspace!.id),
      db.query.payments.findMany({
        where: eq(schema.payments.workspaceId, workspace!.id),
        orderBy: [desc(schema.payments.createdAt)],
        limit: 50
      })
    ]);
    return { status, payments, pricing: await listPublicPricing(), paymentsEnabled: !!process.env.MIDTRANS_SERVER_KEY };
  })

  .post(
    '/api/v1/workspaces/:ws/billing/checkout',
    async ({ workspace, session, body, set }) => {
      try {
        const request =
          body.kind === 'subscription'
            ? { kind: 'subscription' as const, planId: body.planId ?? '' }
            : { kind: 'top_up' as const, packageId: body.packageId ?? '' };
        return await createCheckout({
          workspace: workspace!,
          user: session!.user,
          request,
          finishUrl: `${WEB_URL}/billing`
        });
      } catch (err) {
        set.status = 400;
        return { error: (err as Error).message };
      }
    },
    {
      body: t.Object({
        kind: t.Union([t.Literal('subscription'), t.Literal('top_up')]),
        planId: t.Optional(t.String()),
        packageId: t.Optional(t.String())
      })
    }
  )

  // After returning from Midtrans (or "check status"): re-read the authoritative status.
  .post('/api/v1/workspaces/:ws/billing/payments/:orderId/sync', async ({ workspace, params, set }) => {
    const payment = await db.query.payments.findFirst({
      where: and(eq(schema.payments.orderId, params.orderId), eq(schema.payments.workspaceId, workspace!.id))
    });
    if (!payment) {
      set.status = 404;
      return { error: 'Payment not found' };
    }
    try {
      return await syncPayment(payment.orderId);
    } catch (err) {
      set.status = 502;
      return { error: (err as Error).message };
    }
  })

  // 9. Audit Logs
  .get('/api/v1/workspaces/:ws/audit-logs', async ({ session, params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) return [];

    return await db.query.auditLogs.findMany({
      where: eq(schema.auditLogs.workspaceId, ws.id),
      orderBy: [desc(schema.auditLogs.createdAt)],
      limit: 50
    });
  })

  // 10. Webhooks (Meta & Midtrans)
  // Subscription handshake: echo hub.challenge only for our own verify token (no default value).
  .get('/webhooks/meta', ({ query, set }) => {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
    const token = String(query['hub.verify_token'] ?? '');
    const ok =
      !!expected &&
      query['hub.mode'] === 'subscribe' &&
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!ok) {
      set.status = 403;
      return 'Forbidden';
    }
    return String(query['hub.challenge'] ?? '');
  })

  .post(
    '/webhooks/meta',
    async ({ body, headers, set }) => {
      // 1. Signature over the raw body (fails closed — see verifyMetaSignature).
      const secrets = [process.env.META_APP_SECRET, process.env.META_IG_APP_SECRET].filter((s): s is string => !!s);
      if (!secrets.length) {
        set.status = 503;
        return { error: 'Webhooks not configured' };
      }
      const raw = typeof body === 'string' ? body : '';
      if (!verifyMetaSignature(raw, headers['x-hub-signature-256'], secrets)) {
        set.status = 401;
        return { error: 'Invalid webhook signature' };
      }

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        set.status = 400;
        return { error: 'Invalid JSON' };
      }

      // 2. Fast ACK < 1s: the worker ingests it (ingestWebhookPayload).
      await db.insert(schema.jobs).values({
        type: 'classify_comment',
        payload,
        status: 'pending',
        dedupeKey: `meta_${Date.now()}_${crypto.randomUUID()}`
      });
      return { status: 'received' };
    },
    // Keep the exact bytes Meta signed — re-serialising parsed JSON changes them.
    { parse: 'text' }
  )

  // Midtrans HTTP notification: verify signature, then trust only the Get Status API (idempotent).
  .post('/webhooks/midtrans', async ({ body, set }) => {
    if (!process.env.MIDTRANS_SERVER_KEY) {
      set.status = 503;
      return { error: 'Payments not configured' };
    }
    const n = body as Record<string, string>;
    if (!verifyBillingSignature(n)) {
      set.status = 401;
      return { error: 'Invalid signature' };
    }
    try {
      await syncPayment(n.order_id);
    } catch (err) {
      // Non-2xx makes Midtrans retry later.
      set.status = 502;
      return { error: (err as Error).message };
    }
    return { status: 'ok' };
  });

/** PRD decision 6: trial = Shadow only; expired subscriptions can't publish either. */
async function publishBlockedReason(workspaceId: string): Promise<string | null> {
  const st = await getBillingStatus(workspaceId);
  if (!st) return null; // no subscription row (local dev)
  if (st.expired) return 'Langganan sudah berakhir. Perpanjang paket di menu Kuota & Paket.';
  if (st.isTrial) return 'Masa trial hanya mode Shadow (draft tanpa kirim). Upgrade paket untuk membalas/menyembunyikan komentar.';
  return null;
}

// Helper
async function getWorkspaceBySlugOrId(identifier: string) {
  return (
    (await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, identifier) })) ||
    (await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, identifier as any) }))
  );
}

if (import.meta.main) {
  app.listen(PORT, () => {
    console.log(`Replyra API running on http://localhost:${PORT}`);
    console.log(`API docs available at http://localhost:${PORT}/swagger`);
  });
}
