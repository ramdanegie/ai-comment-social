import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { db, schema } from '@replyra/db';
import { eq, desc, and, sql, ilike, inArray } from 'drizzle-orm';
import { LlmClassifier } from './contexts/moderation/domain/LlmClassifier';
import { ReplyPolicyEvaluator } from './contexts/response/domain/ReplyPolicyEvaluator';
import { LlmReplyGenerator } from './contexts/response/domain/LlmReplyGenerator';
import { encryptToken, verifyMetaSignature, verifyMidtransSignature } from './shared/infrastructure/crypto';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3099;

export const app = new Elysia()
  .use(cors())
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

  // Current User Context from Database
  .get('/api/v1/auth/me', async () => {
    const user = await db.query.users.findFirst();
    if (!user) throw new Error('No users found in database');
    return user;
  })

  // All Users from Database
  .get('/api/v1/users', async () => {
    const list = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        createdAt: schema.users.createdAt,
        role: schema.memberships.role,
        workspaceSlug: schema.workspaces.slug
      })
      .from(schema.users)
      .leftJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
      .leftJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId));
    return list;
  })

  // User Login from Database
  .post(
    '/api/v1/auth/login',
    async ({ body, set }) => {
      const email = body.email.trim().toLowerCase();
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
      });
      if (!user) {
        set.status = 404;
        return { error: 'Pengguna tidak ditemukan di database.' };
      }

      const membership = await db.query.memberships.findFirst({
        where: eq(schema.memberships.userId, user.id)
      });

      return {
        user,
        role: membership?.role || 'viewer',
        token: `session_${user.id}_${Date.now()}`
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.Optional(t.String())
      })
    }
  )

  // Google OAuth / SSO Login to Database
  .post(
    '/api/v1/auth/google',
    async ({ body }) => {
      const email = (body.email || 'budi.santoso@gmail.com').trim().toLowerCase();
      const name = body.name || (email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
      const avatarUrl = body.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop';

      let defaultWs = await db.query.workspaces.findFirst({
        where: eq(schema.workspaces.slug, 'maujahit')
      });
      if (!defaultWs) {
        defaultWs = await db.query.workspaces.findFirst();
      }

      let user = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
      });

      if (!user) {
        const id = `usr_google_${Date.now().toString(36)}`;
        const [newUser] = await db
          .insert(schema.users)
          .values({
            id,
            email,
            name,
            avatarUrl
          })
          .returning();
        user = newUser;

        if (defaultWs) {
          await db
            .insert(schema.memberships)
            .values({
              workspaceId: defaultWs.id,
              userId: user.id,
              role: 'owner'
            })
            .onConflictDoNothing();

          await db.insert(schema.auditLogs).values({
            workspaceId: defaultWs.id,
            actor: user.id,
            action: 'auth.google_signup',
            targetType: 'user',
            targetId: user.id,
            meta: { provider: 'google', email, method: 'sso_oauth' }
          });
        }
      } else {
        if (avatarUrl && avatarUrl !== user.avatarUrl) {
          await db.update(schema.users).set({ avatarUrl }).where(eq(schema.users.id, user.id));
        }

        if (defaultWs) {
          await db.insert(schema.auditLogs).values({
            workspaceId: defaultWs.id,
            actor: user.id,
            action: 'auth.google_login',
            targetType: 'user',
            targetId: user.id,
            meta: { provider: 'google', email, method: 'sso_oauth' }
          });
        }
      }

      const membership = await db.query.memberships.findFirst({
        where: eq(schema.memberships.userId, user.id)
      });

      return {
        user,
        role: membership?.role || 'owner',
        token: `google_session_${user.id}_${Date.now()}`
      };
    },
    {
      body: t.Object({
        email: t.Optional(t.String()),
        name: t.Optional(t.String()),
        avatarUrl: t.Optional(t.String()),
        credential: t.Optional(t.String())
      })
    }
  )

  // 1. Workspaces
  .get('/api/v1/workspaces', async () => {
    const list = await db.query.workspaces.findMany({
      orderBy: [desc(schema.workspaces.createdAt)]
    });
    return list;
  })

  .post(
    '/api/v1/workspaces',
    async ({ body }) => {
      const slug = body.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const [ws] = await db
        .insert(schema.workspaces)
        .values({
          name: body.name,
          slug
        })
        .returning();

      // Create trial subscription
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 14);
      await db.insert(schema.subscriptions).values({
        workspaceId: ws.id,
        planId: 'growth',
        periodStart: new Date(),
        periodEnd,
        extraAiUnits: 250,
        status: 'trial'
      });

      return ws;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 })
      })
    }
  )

  // Workspace Members from Database
  .get('/api/v1/workspaces/:ws/members', async ({ params }) => {
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
    async ({ params, body }) => {
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
  .get('/api/v1/workspaces/:ws/accounts', async ({ params }) => {
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

  .post(
    '/api/v1/workspaces/:ws/accounts/connect/meta',
    async ({ params, body }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      const encrypted = encryptToken(body.accessToken);
      const [acc] = await db
        .insert(schema.socialAccounts)
        .values({
          workspaceId: ws.id,
          platform: body.platform as any,
          externalId: body.externalId,
          username: body.username,
          avatarUrl: body.avatarUrl || 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=120&h=120&fit=crop',
          accessTokenEnc: encrypted,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
          scopes: ['instagram_basic', 'instagram_manage_comments', 'pages_read_engagement'],
          status: 'connected',
          lastSyncedAt: new Date()
        })
        .returning();

      // Create default policy (starts in Shadow Mode per PRD §10.1)
      await db.insert(schema.replyPolicies).values({
        socialAccountId: acc.id,
        mode: 'shadow',
        autoReplyIntents: ['praise', 'purchase_intent'],
        minConfidence: 0.8,
        dailyAutoReplyLimit: 200,
        minIntervalSeconds: 20,
        activeHours: { start: '08:00', end: '22:00', tz: 'Asia/Jakarta' },
        brandVoice: {
          brandName: body.username,
          tone: 'Ramah dan profesional',
          useEmoji: true,
          cta: 'Silakan hubungi DM kami ya kak!',
          forbiddenPhrases: []
        },
        autoHideSpam: true
      });

      await db.insert(schema.auditLogs).values({
        workspaceId: ws.id,
        actor: 'user',
        action: 'account.connected',
        targetType: 'social_account',
        targetId: acc.id,
        meta: { platform: acc.platform, username: acc.username }
      });

      return { success: true, account: acc };
    },
    {
      body: t.Object({
        platform: t.String(),
        externalId: t.String(),
        username: t.String(),
        avatarUrl: t.Optional(t.String()),
        accessToken: t.String()
      })
    }
  )

  .delete('/api/v1/workspaces/:ws/accounts/:id', async ({ params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    await db.delete(schema.socialAccounts).where(
      and(eq(schema.socialAccounts.id, params.id as any), eq(schema.socialAccounts.workspaceId, ws.id))
    );

    await db.insert(schema.auditLogs).values({
      workspaceId: ws.id,
      actor: 'user',
      action: 'account.disconnected',
      targetType: 'social_account',
      targetId: params.id,
      meta: { timestamp: new Date() }
    });

    return { success: true };
  })

  // 3. Comments (List, Filter, Search, Detail, Label Correction)
  .get('/api/v1/workspaces/:ws/comments', async ({ params, query }) => {
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

  .get('/api/v1/workspaces/:ws/comments/:id', async ({ params }) => {
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
    async ({ params, body }) => {
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
        actor: 'user',
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
  .get('/api/v1/workspaces/:ws/review', async ({ params }) => {
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
    async ({ params, body }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      const existingReply = await db.query.replies.findFirst({
        where: eq(schema.replies.commentId, params.commentId as any)
      });

      const replyText = body?.text || existingReply?.draftText || 'Terima kasih atas pesan Anda!';

      if (existingReply) {
        await db
          .update(schema.replies)
          .set({
            finalText: replyText,
            source: 'human_approved',
            sentAt: new Date()
          })
          .where(eq(schema.replies.id, existingReply.id));
      } else {
        await db.insert(schema.replies).values({
          commentId: params.commentId as any,
          draftText: replyText,
          finalText: replyText,
          source: 'human_approved',
          sentAt: new Date()
        });
      }

      await db
        .update(schema.comments)
        .set({ status: 'REPLIED' })
        .where(eq(schema.comments.id, params.commentId as any));

      await db.insert(schema.auditLogs).values({
        workspaceId: ws.id,
        actor: 'user',
        action: 'reply.approved',
        targetType: 'comment',
        targetId: params.commentId,
        meta: { finalText: replyText }
      });

      return { success: true, status: 'REPLIED' };
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
  .post('/api/v1/workspaces/:ws/review/:commentId/regenerate', async ({ params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const comment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, params.commentId as any)
    });
    if (!comment) throw new Error('Comment not found');

    const policy = await db.query.replyPolicies.findFirst({
      where: eq(schema.replyPolicies.socialAccountId, comment.socialAccountId)
    });

    const classification = await db.query.classifications.findFirst({
      where: eq(schema.classifications.commentId, comment.id)
    });

    const brandVoice = (policy?.brandVoice as any) || {
      brandName: 'MauJahit.id',
      tone: 'Ramah dan bersahabat',
      useEmoji: true,
      cta: 'Silakan DM kami ya kak!',
      forbiddenPhrases: []
    };

    const newDraft = LlmReplyGenerator.generate(
      comment.text,
      comment.authorName,
      (classification as any) || { sentiment: 'positive', riskLabel: 'none', intent: 'praise' },
      brandVoice
    );

    await db
      .update(schema.replies)
      .set({ draftText: newDraft })
      .where(eq(schema.replies.commentId, comment.id));

    return { success: true, draftText: newDraft };
  })

  // Hide comment (shortcut H)
  .post('/api/v1/workspaces/:ws/review/:commentId/hide', async ({ params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    await db
      .update(schema.comments)
      .set({ status: 'HIDDEN' })
      .where(eq(schema.comments.id, params.commentId as any));

    await db.insert(schema.auditLogs).values({
      workspaceId: ws.id,
      actor: 'user',
      action: 'comment.hidden',
      targetType: 'comment',
      targetId: params.commentId,
      meta: { timestamp: new Date() }
    });

    return { success: true, status: 'HIDDEN' };
  })

  // Dismiss comment (shortcut D)
  .post('/api/v1/workspaces/:ws/review/:commentId/dismiss', async ({ params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    await db
      .update(schema.comments)
      .set({ status: 'DISMISSED' })
      .where(eq(schema.comments.id, params.commentId as any));

    await db.insert(schema.auditLogs).values({
      workspaceId: ws.id,
      actor: 'user',
      action: 'comment.dismissed',
      targetType: 'comment',
      targetId: params.commentId,
      meta: { timestamp: new Date() }
    });

    return { success: true, status: 'DISMISSED' };
  })

  // 5. Reply Policy GET / PUT / Preview
  .get('/api/v1/workspaces/:ws/accounts/:id/policy', async ({ params }) => {
    const policy = await db.query.replyPolicies.findFirst({
      where: eq(schema.replyPolicies.socialAccountId, params.id as any)
    });
    return policy;
  })

  .put(
    '/api/v1/workspaces/:ws/accounts/:id/policy',
    async ({ params, body }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      const [updated] = await db
        .update(schema.replyPolicies)
        .set({
          mode: body.mode,
          autoReplyIntents: body.autoReplyIntents as any,
          minConfidence: body.minConfidence,
          dailyAutoReplyLimit: body.dailyAutoReplyLimit,
          minIntervalSeconds: body.minIntervalSeconds,
          brandVoice: body.brandVoice,
          customBlockedKeywords: body.customBlockedKeywords,
          autoHideSpam: body.autoHideSpam
        })
        .where(eq(schema.replyPolicies.socialAccountId, params.id as any))
        .returning();

      await db.insert(schema.auditLogs).values({
        workspaceId: ws.id,
        actor: 'user',
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
        customBlockedKeywords: t.Array(t.String()),
        autoHideSpam: t.Boolean()
      })
    }
  )

  // Policy live preview tester
  .post(
    '/api/v1/workspaces/:ws/accounts/:id/policy/preview',
    async ({ body }) => {
      const bv: any = typeof body.brandVoice === 'object' && body.brandVoice !== null
        ? { ...body.brandVoice }
        : { tone: String(body.brandVoice || 'Ramah'), brandName: 'MauJahit.id', useEmoji: true, defaultCta: 'Silakan DM kami ya kak!', forbiddenPhrases: [] };
      if (!bv.brandName) bv.brandName = 'MauJahit.id';

      const classification = await LlmClassifier.classify(
        body.sampleComment,
        null,
        bv.brandName,
        body.customBlockedKeywords || []
      );

      const draft = LlmReplyGenerator.generate(
        body.sampleComment,
        body.sampleAuthor || 'Kakak',
        classification,
        bv
      );

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
        postCheck
      };
    },
    {
      body: t.Object({
        sampleComment: t.String(),
        sampleAuthor: t.Optional(t.String()),
        mode: t.String(),
        autoReplyIntents: t.Array(t.String()),
        minConfidence: t.Number(),
        brandVoice: t.Any(),
        customBlockedKeywords: t.Optional(t.Array(t.String())),
        autoHideSpam: t.Boolean()
      })
    }
  )

  // 6. Dashboard Summary & Trends (PRD §5.1 FR-6, §10)
  .get('/api/v1/workspaces/:ws/dashboard/summary', async ({ params }) => {
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
      medianResponseSec: 360,
      responseTimeText: '6 Menit (Rata-rata)'
    };
  })

  .get('/api/v1/workspaces/:ws/dashboard/trend', async ({ params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) return [];

    const metrics = await db.query.dailyMetrics.findMany({
      where: eq(schema.dailyMetrics.workspaceId, ws.id),
      orderBy: [desc(schema.dailyMetrics.day)],
      limit: 14
    });

    return metrics.reverse();
  })

  // 7. Reports & CSV Export (PRD §5.1 FR-7)
  .get('/api/v1/workspaces/:ws/reports', async ({ params, query }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const metrics = await db.query.dailyMetrics.findMany({
      where: eq(schema.dailyMetrics.workspaceId, ws.id),
      orderBy: [desc(schema.dailyMetrics.day)],
      limit: query.period === 'weekly' ? 28 : 14
    });

    const topPosts = await db.query.posts.findMany({
      limit: 5
    });

    return {
      period: query.period || 'daily',
      metrics,
      topPosts: topPosts.map((p, idx) => ({
        ...p,
        commentCount: 45 - idx * 8,
        positiveRatio: 0.85 - idx * 0.05
      }))
    };
  })

  .get('/api/v1/workspaces/:ws/reports/export.csv', async ({ params, set }) => {
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

  // 8. Billing & Plans (PRD §5.1 FR-9, §10)
  .get('/api/v1/plans', async () => {
    return await db.query.plans.findMany();
  })

  .get('/api/v1/workspaces/:ws/billing', async ({ params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) throw new Error('Workspace not found');

    const sub = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.workspaceId, ws.id)
    });
    const plan = sub ? await db.query.plans.findFirst({ where: eq(schema.plans.id, sub.planId) }) : null;

    // Usage count this month
    const usage = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.usageEvents)
      .where(eq(schema.usageEvents.workspaceId, ws.id));

    const usedUnits = Number(usage[0]?.count || 0);
    const totalUnits = (plan?.monthlyAiUnits || 1000) + (sub?.extraAiUnits || 0);

    const payments = await db.query.payments.findMany({
      where: eq(schema.payments.workspaceId, ws.id),
      orderBy: [desc(schema.payments.createdAt)]
    });

    return {
      subscription: sub,
      plan,
      usedUnits,
      totalUnits,
      percentUsed: Math.min(100, Math.round((usedUnits / totalUnits) * 100)),
      paymentHistory: payments
    };
  })

  .post(
    '/api/v1/workspaces/:ws/billing/checkout',
    async ({ params, body }) => {
      const ws = await getWorkspaceBySlugOrId(params.ws);
      if (!ws) throw new Error('Workspace not found');

      const orderId = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      let amount = 799000;
      if (body.kind === 'top_up') {
        amount = (body.aiUnits || 500) * 300; // Rp 150.000 per 500 unit
      } else if (body.planId === 'starter') {
        amount = 299000;
      } else if (body.planId === 'agency') {
        amount = 1999000;
      }

      const [pay] = await db
        .insert(schema.payments)
        .values({
          workspaceId: ws.id,
          orderId,
          kind: body.kind,
          planId: body.planId || null,
          aiUnits: body.aiUnits || null,
          amountIdr: amount,
          status: 'pending'
        })
        .returning();

      // Return mock Midtrans Snap token for instant interactive demo
      const snapToken = `snap_token_${orderId}_demo`;
      return {
        orderId,
        snapToken,
        redirectUrl: `https://app.midtrans.com/snap/v2/vtweb/${snapToken}`,
        amount
      };
    },
    {
      body: t.Object({
        kind: t.String(),
        planId: t.Optional(t.String()),
        aiUnits: t.Optional(t.Number())
      })
    }
  )

  // 9. Audit Logs
  .get('/api/v1/workspaces/:ws/audit-logs', async ({ params }) => {
    const ws = await getWorkspaceBySlugOrId(params.ws);
    if (!ws) return [];

    return await db.query.auditLogs.findMany({
      where: eq(schema.auditLogs.workspaceId, ws.id),
      orderBy: [desc(schema.auditLogs.createdAt)],
      limit: 50
    });
  })

  // 10. Webhooks (Meta & Midtrans)
  .get('/webhooks/meta', ({ query }) => {
    // Hub challenge verification
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === (process.env.META_WEBHOOK_VERIFY_TOKEN || 'replyra_verify_token_2026')) {
      return challenge;
    }
    return 'Invalid verify token';
  })

  .post('/webhooks/meta', async ({ body, headers, set }) => {
    // 1. Signature check
    const sig = headers['x-hub-signature-256'];
    const appSecret = process.env.META_APP_SECRET || '';
    if (appSecret && !verifyMetaSignature(JSON.stringify(body), sig, appSecret)) {
      set.status = 401;
      return { error: 'Invalid webhook signature' };
    }

    // 2. Fast ACK < 1s: insert job into DB
    const dedupeKey = `meta_${Date.now()}_${Math.random()}`;
    await db.insert(schema.jobs).values({
      type: 'classify_comment',
      payload: body,
      status: 'pending',
      dedupeKey
    });

    return { status: 'received' };
  })

  .post('/webhooks/midtrans', async ({ body, set }) => {
    const orderId = body.order_id;
    const statusCode = body.status_code;
    const grossAmount = body.gross_amount;
    const sigKey = body.signature_key;
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'dummy_server_key';

    if (process.env.MIDTRANS_SERVER_KEY && !verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, sigKey)) {
      set.status = 401;
      return { error: 'Invalid Midtrans signature' };
    }

    // Update payment
    const payment = await db.query.payments.findFirst({
      where: eq(schema.payments.orderId, orderId)
    });

    if (payment) {
      const isPaid = ['capture', 'settlement'].includes(body.transaction_status);
      await db
        .update(schema.payments)
        .set({
          status: isPaid ? 'settlement' : body.transaction_status,
          paidAt: isPaid ? new Date() : null,
          paymentType: body.payment_type || 'qris',
          rawNotification: body
        })
        .where(eq(schema.payments.id, payment.id));

      if (isPaid && payment.kind === 'top_up' && payment.aiUnits) {
        await db
          .update(schema.subscriptions)
          .set({
            extraAiUnits: sql`${schema.subscriptions.extraAiUnits} + ${payment.aiUnits}`
          })
          .where(eq(schema.subscriptions.workspaceId, payment.workspaceId));
      }
    }

    return { status: 'ok' };
  });

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
