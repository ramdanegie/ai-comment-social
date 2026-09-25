// Use cases: poll Meta accounts, ingest comments, classify + decide action, send reply / hide on platform.
// Called from worker.ts job handlers. All Graph API I/O happens here, never in HTTP handlers (PRD §18.1-4).

import { db, schema } from '@replyra/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  MetaGraph,
  MetaGraphError,
  metaApiFor,
  refreshInstagramToken,
  type MetaPlatform,
  type NormalizedComment
} from '../../channel/infrastructure/MetaGraphClient';
import { classifyComment, draftReply } from '../../moderation/application/AiModeration';
import { ReplyPolicyEvaluator, type ReplyPolicyEntity } from '../../response/domain/ReplyPolicyEvaluator';
import { decryptToken, encryptToken } from '../../../shared/infrastructure/crypto';

const POSTS_PER_POLL = Number(process.env.META_POLL_POSTS || 10);
/** META_DRY_RUN=true → never call reply/hide on Meta, only log. Safe default for first tests. */
const DRY_RUN = process.env.META_DRY_RUN === 'true';

type SocialAccount = typeof schema.socialAccounts.$inferSelect;
type Post = typeof schema.posts.$inferSelect;
type Comment = typeof schema.comments.$inferSelect;

export const isMetaPlatform = (p: string): p is MetaPlatform => p === 'instagram' || p === 'facebook';

async function markAccountExpired(account: SocialAccount, err: MetaGraphError) {
  await db.update(schema.socialAccounts).set({ status: 'expired' }).where(eq(schema.socialAccounts.id, account.id));
  await audit(account.workspaceId, 'account.token_expired', 'social_account', account.id, { error: err.message });
}

async function audit(workspaceId: string, action: string, targetType: string, targetId: string, meta?: unknown) {
  await db.insert(schema.auditLogs).values({ workspaceId, actor: 'system', action, targetType, targetId, meta });
}

export async function enqueueJob(type: string, payload: Record<string, unknown>, dedupeKey?: string, runAt?: Date) {
  await db
    .insert(schema.jobs)
    .values({ type, payload, dedupeKey, runAt: runAt ?? new Date() })
    .onConflictDoNothing({ target: schema.jobs.dedupeKey });
}

// ---------- Polling ----------

const REFRESH_BEFORE_MS = 7 * 24 * 3600 * 1000;

/** Instagram Login tokens live 60 days; refresh during the last week so polling never stops. */
async function ensureFreshToken(account: SocialAccount): Promise<string> {
  const token = decryptToken(account.accessTokenEnc);
  if (metaApiFor(account) !== 'instagram_login' || !account.tokenExpiresAt) return token;
  if (account.tokenExpiresAt.getTime() - Date.now() > REFRESH_BEFORE_MS) return token;

  try {
    const res = await refreshInstagramToken(token);
    await db
      .update(schema.socialAccounts)
      .set({ accessTokenEnc: encryptToken(res.access_token), tokenExpiresAt: new Date(Date.now() + res.expires_in * 1000) })
      .where(eq(schema.socialAccounts.id, account.id));
    await audit(account.workspaceId, 'account.token_refreshed', 'social_account', account.id);
    return res.access_token;
  } catch (err) {
    console.warn(`[MetaIngestion] token refresh failed for ${account.id}: ${(err as Error).message}`);
    return token; // still valid until tokenExpiresAt; 190 on use marks it expired
  }
}

export async function pollAccount(accountId: string) {
  const account = await db.query.socialAccounts.findFirst({ where: eq(schema.socialAccounts.id, accountId) });
  if (!account || account.status !== 'connected' || !isMetaPlatform(account.platform)) return { skipped: true };

  const api = metaApiFor(account);
  let newCount = 0;

  try {
    const token = await ensureFreshToken(account);
    const remotePosts = await MetaGraph.listPosts(account.platform, account.externalId, token, POSTS_PER_POLL, api);

    for (const rp of remotePosts) {
      const post = await upsertPost(account, rp);
      const remoteComments = await MetaGraph.listComments(account.platform, rp.externalId, token, api);
      for (const rc of remoteComments) {
        if (await ingestComment(account, post, rc)) newCount++;
      }
    }
  } catch (err) {
    if (err instanceof MetaGraphError && err.isTokenInvalid) {
      await markAccountExpired(account, err);
      return { skipped: true, reason: 'token_expired' };
    }
    throw err;
  }

  await db.update(schema.socialAccounts).set({ lastSyncedAt: new Date() }).where(eq(schema.socialAccounts.id, account.id));
  return { skipped: false, newComments: newCount };
}

async function upsertPost(
  account: SocialAccount,
  rp: { externalId: string; caption: string | null; permalink: string | null; mediaUrl: string | null; publishedAt: Date | null }
): Promise<Post> {
  const [post] = await db
    .insert(schema.posts)
    .values({ socialAccountId: account.id, ...rp })
    .onConflictDoUpdate({
      target: [schema.posts.socialAccountId, schema.posts.externalId],
      // Webhooks only carry the post id — keep previously polled caption/permalink.
      set: {
        caption: sql`coalesce(excluded.caption, ${schema.posts.caption})`,
        permalink: sql`coalesce(excluded.permalink, ${schema.posts.permalink})`,
        mediaUrl: sql`coalesce(excluded.media_url, ${schema.posts.mediaUrl})`
      }
    })
    .returning();
  return post;
}

function isOwnComment(account: SocialAccount, rc: NormalizedComment) {
  // Invariant §4.3-4: never reply to the brand's own comments.
  if (rc.authorExternalId && rc.authorExternalId === account.externalId) return true;
  return account.platform === 'instagram' && rc.authorName?.toLowerCase() === account.username.toLowerCase();
}

/** Returns true when the comment is new. Dedup via uq_comment(platform, external_id) — AC-2. */
export async function ingestComment(account: SocialAccount, post: Post | null, rc: NormalizedComment) {
  if (!rc.text.trim() || isOwnComment(account, rc)) return false;

  const [inserted] = await db
    .insert(schema.comments)
    .values({
      workspaceId: account.workspaceId,
      socialAccountId: account.id,
      postId: post?.id,
      platform: account.platform,
      externalId: rc.externalId,
      authorName: rc.authorName,
      authorExternalId: rc.authorExternalId,
      text: rc.text,
      commentedAt: rc.commentedAt
    })
    .onConflictDoNothing({ target: [schema.comments.platform, schema.comments.externalId] })
    .returning();

  if (!inserted) return false;
  await classifyAndDecide(account, post, inserted);
  return true;
}

// ---------- Classification + policy ----------

async function countAutoRepliesToday(accountId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.replies)
    .innerJoin(schema.comments, eq(schema.comments.id, schema.replies.commentId))
    .where(
      and(
        eq(schema.comments.socialAccountId, accountId),
        eq(schema.replies.source, 'auto'),
        gte(schema.replies.sentAt, startOfDay)
      )
    );
  return row?.n ?? 0;
}

async function classifyAndDecide(account: SocialAccount, post: Post | null, comment: Comment) {
  const policyRow = await db.query.replyPolicies.findFirst({
    where: eq(schema.replyPolicies.socialAccountId, account.id)
  });
  if (!policyRow) {
    await db.update(schema.comments).set({ status: 'NEEDS_REVIEW' }).where(eq(schema.comments.id, comment.id));
    return;
  }
  const policy = policyRow as unknown as ReplyPolicyEntity & { customBlockedKeywords: string[] | null };

  const classification = await classifyComment({
    workspaceId: account.workspaceId,
    commentId: comment.id,
    text: comment.text,
    postCaption: post?.caption ?? null,
    brandName: policy.brandVoice?.brandName || account.username,
    customKeywords: policy.customBlockedKeywords ?? []
  });

  await db
    .insert(schema.classifications)
    .values({ commentId: comment.id, ...classification })
    .onConflictDoNothing({ target: schema.classifications.commentId });

  let { targetStatus, reason } = ReplyPolicyEvaluator.evaluate(
    classification,
    policy,
    await countAutoRepliesToday(account.id)
  );

  // Shadow/trial mode never touches the platform — spam goes to review instead of being hidden.
  if (targetStatus === 'HIDDEN' && policy.mode === 'shadow') {
    targetStatus = 'NEEDS_REVIEW';
    reason = 'Spam terdeteksi; mode Shadow tidak menyembunyikan komentar otomatis';
  }

  // Draft only for comments without risk; hate/threat/toxic/spam never get an AI draft (PRD §5.3).
  if (classification.riskLabel === 'none') {
    const { text: draft } = await draftReply({
      workspaceId: account.workspaceId,
      commentId: comment.id,
      input: {
        commentText: comment.text,
        authorName: comment.authorName,
        postCaption: post?.caption ?? null,
        classification,
        brandVoice: { ...policy.brandVoice, brandName: policy.brandVoice?.brandName || account.username }
      }
    });
    const check = ReplyPolicyEvaluator.postCheckReply(draft, policy.brandVoice);
    if (!check.passed && targetStatus === 'AUTO_REPLY_QUEUED') {
      targetStatus = 'NEEDS_REVIEW';
      reason = `Post-check gagal: ${check.violations.join('; ')}`;
    }

    await db
      .insert(schema.replies)
      .values({
        commentId: comment.id,
        draftText: draft,
        source: targetStatus === 'AUTO_REPLY_QUEUED' ? 'auto' : null
      })
      .onConflictDoNothing({ target: schema.replies.commentId });
  } else if (targetStatus === 'AUTO_REPLY_QUEUED') {
    targetStatus = 'NEEDS_REVIEW';
  }

  await db.update(schema.comments).set({ status: targetStatus }).where(eq(schema.comments.id, comment.id));
  await audit(account.workspaceId, 'comment.classified', 'comment', comment.id, { ...classification, targetStatus, reason });

  if (targetStatus === 'AUTO_REPLY_QUEUED') {
    await enqueueJob('send_reply', { commentId: comment.id }, `send_reply:${comment.id}`);
  } else if (targetStatus === 'HIDDEN') {
    await enqueueJob('hide_comment', { commentId: comment.id, hide: true }, `hide_comment:${comment.id}`);
  }
}

// ---------- Outbound actions ----------

async function loadCommentContext(commentId: string) {
  const comment = await db.query.comments.findFirst({ where: eq(schema.comments.id, commentId) });
  if (!comment) throw new Error(`Comment ${commentId} not found`);
  const account = await db.query.socialAccounts.findFirst({
    where: eq(schema.socialAccounts.id, comment.socialAccountId)
  });
  if (!account || !isMetaPlatform(account.platform)) throw new Error(`Meta account for comment ${commentId} not found`);
  return { comment, account, platform: account.platform as MetaPlatform, api: metaApiFor(account) };
}

/** Idempotent (§5.4): a reply that already has externalReplyId is never sent again (invariant §4.3-3). */
export async function sendReply(commentId: string) {
  const { comment, account, platform, api } = await loadCommentContext(commentId);
  const reply = await db.query.replies.findFirst({ where: eq(schema.replies.commentId, commentId) });
  if (!reply) throw new Error(`No reply draft for comment ${commentId}`);
  if (reply.externalReplyId) return { alreadySent: true };

  const text = reply.finalText ?? reply.draftText;
  let externalReplyId = `dry_run_${Date.now()}`;

  try {
    if (DRY_RUN) {
      console.log(`[DRY_RUN] ${platform} reply to ${comment.externalId}: ${text}`);
    } else {
      const res = await MetaGraph.reply(platform, comment.externalId, text, decryptToken(account.accessTokenEnc), api);
      externalReplyId = res.id;
    }
  } catch (err) {
    await db
      .update(schema.replies)
      .set({ attempts: reply.attempts + 1, error: (err as Error).message })
      .where(eq(schema.replies.id, reply.id));
    if (err instanceof MetaGraphError && err.isTokenInvalid) await markAccountExpired(account, err);
    throw err;
  }

  await db
    .update(schema.replies)
    .set({ externalReplyId, finalText: text, sentAt: new Date(), error: null })
    .where(eq(schema.replies.id, reply.id));
  await db.update(schema.comments).set({ status: 'REPLIED' }).where(eq(schema.comments.id, commentId));
  await audit(comment.workspaceId, 'reply.sent', 'comment', commentId, { externalReplyId, source: reply.source, dryRun: DRY_RUN });
  return { alreadySent: false, externalReplyId };
}

export async function hideComment(commentId: string, hide: boolean) {
  const { comment, account, platform, api } = await loadCommentContext(commentId);

  if (DRY_RUN) {
    console.log(`[DRY_RUN] ${platform} ${hide ? 'hide' : 'unhide'} ${comment.externalId}`);
  } else {
    try {
      await MetaGraph.hide(platform, comment.externalId, hide, decryptToken(account.accessTokenEnc), api);
    } catch (err) {
      if (err instanceof MetaGraphError && err.isTokenInvalid) await markAccountExpired(account, err);
      throw err;
    }
  }

  await db
    .update(schema.comments)
    .set({ status: hide ? 'HIDDEN' : 'NEEDS_REVIEW' })
    .where(eq(schema.comments.id, commentId));
  await audit(comment.workspaceId, hide ? 'comment.hidden' : 'comment.unhidden', 'comment', commentId, { dryRun: DRY_RUN });
}

/** Called by the worker after the last retry fails (PRD §3.2 → FAILED). */
export async function markCommentFailed(commentId: string, error: string) {
  await db.update(schema.comments).set({ status: 'FAILED' }).where(eq(schema.comments.id, commentId));
  const comment = await db.query.comments.findFirst({ where: eq(schema.comments.id, commentId) });
  if (comment) await audit(comment.workspaceId, 'reply.failed', 'comment', commentId, { error });
}

// ---------- Webhook payload (works once the app is Live + Advanced Access) ----------

export async function ingestWebhookPayload(payload: any) {
  const entries: any[] = payload?.entry ?? [];
  let newCount = 0;

  for (const entry of entries) {
    const platform: MetaPlatform = payload.object === 'instagram' ? 'instagram' : 'facebook';
    const account = await db.query.socialAccounts.findFirst({
      where: and(eq(schema.socialAccounts.platform, platform), eq(schema.socialAccounts.externalId, String(entry.id)))
    });
    if (!account || account.status !== 'connected') continue;

    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      let postExternalId: string | undefined;
      let rc: NormalizedComment | undefined;

      if (platform === 'instagram' && change.field === 'comments' && !v.parent_id) {
        postExternalId = v.media?.id;
        rc = {
          externalId: v.id,
          text: v.text ?? '',
          authorName: v.from?.username ?? null,
          authorExternalId: v.from?.id ?? null,
          commentedAt: new Date()
        };
      } else if (
        platform === 'facebook' &&
        change.field === 'feed' &&
        v.item === 'comment' &&
        v.verb === 'add' &&
        v.parent_id === v.post_id
      ) {
        postExternalId = v.post_id;
        rc = {
          externalId: v.comment_id,
          text: v.message ?? '',
          authorName: v.from?.name ?? null,
          authorExternalId: v.from?.id ?? null,
          commentedAt: v.created_time ? new Date(v.created_time * 1000) : new Date()
        };
      }
      if (!rc) continue;

      const post = postExternalId
        ? await upsertPost(account, { externalId: postExternalId, caption: null, permalink: null, mediaUrl: null, publishedAt: null })
        : null;
      if (await ingestComment(account, post, rc)) newCount++;
    }
  }
  return { newComments: newCount };
}
