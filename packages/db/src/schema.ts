import { pgTable, uuid, text, timestamp, integer, real, boolean, jsonb, pgEnum, uniqueIndex, index, date } from 'drizzle-orm/pg-core';

export const platformEnum = pgEnum('platform', ['instagram', 'facebook', 'tiktok']);
export const roleEnum = pgEnum('role', ['owner', 'admin', 'viewer']);
export const sentimentEnum = pgEnum('sentiment', ['positive', 'neutral', 'negative']);
export const riskEnum = pgEnum('risk_label', ['none', 'spam', 'toxic', 'hate', 'threat', 'sensitive']);
export const intentEnum = pgEnum('intent', ['praise', 'purchase_intent', 'question', 'complaint', 'other']);
export const commentStatus = pgEnum('comment_status', [
  'RECEIVED',
  'CLASSIFIED',
  'AUTO_REPLY_QUEUED',
  'NEEDS_REVIEW',
  'APPROVED',
  'REPLIED',
  'HIDDEN',
  'DISMISSED',
  'IGNORED',
  'FAILED'
]);
export const replySource = pgEnum('reply_source', ['auto', 'human_approved', 'human_written']);
export const jobStatus = pgEnum('job_status', ['pending', 'running', 'done', 'failed']);

// Better Auth core tables (see apps/server/src/shared/infrastructure/auth.ts).
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)]
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull()
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)]
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)]
);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id').notNull(),
    role: roleEnum('role').notNull()
  },
  (t) => [uniqueIndex('uq_member').on(t.workspaceId, t.userId)]
);

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    platform: platformEnum('platform').notNull(),
    externalId: text('external_id').notNull(),
    username: text('username').notNull(),
    avatarUrl: text('avatar_url'),
    accessTokenEnc: text('access_token_enc').notNull(),
    tokenExpiresAt: timestamp('token_expires_at'),
    scopes: text('scopes').array(),
    status: text('status').notNull().default('connected'), // connected | expired | revoked
    lastSyncedAt: timestamp('last_synced_at')
  },
  (t) => [uniqueIndex('uq_account').on(t.platform, t.externalId)]
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    socialAccountId: uuid('social_account_id')
      .references(() => socialAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    externalId: text('external_id').notNull(),
    caption: text('caption'),
    permalink: text('permalink'),
    mediaUrl: text('media_url'),
    publishedAt: timestamp('published_at')
  },
  (t) => [uniqueIndex('uq_post').on(t.socialAccountId, t.externalId)]
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    socialAccountId: uuid('social_account_id')
      .references(() => socialAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    postId: uuid('post_id').references(() => posts.id),
    platform: platformEnum('platform').notNull(),
    externalId: text('external_id').notNull(),
    parentExternalId: text('parent_external_id'),
    authorName: text('author_name'),
    authorExternalId: text('author_external_id'),
    text: text('text').notNull(),
    commentedAt: timestamp('commented_at').notNull(),
    status: commentStatus('status').notNull().default('RECEIVED'),
    receivedAt: timestamp('received_at').defaultNow().notNull()
  },
  (t) => [
    uniqueIndex('uq_comment').on(t.platform, t.externalId),
    index('ix_comment_ws_status').on(t.workspaceId, t.status),
    index('ix_comment_ws_date').on(t.workspaceId, t.commentedAt)
  ]
);

export const classifications = pgTable('classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id')
    .references(() => comments.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  sentiment: sentimentEnum('sentiment').notNull(),
  riskLabel: riskEnum('risk_label').notNull(),
  intent: intentEnum('intent').notNull(),
  confidence: real('confidence').notNull(),
  reason: text('reason'),
  prefilterHits: text('prefilter_hits').array(),
  model: text('model').notNull(),
  humanSentiment: sentimentEnum('human_sentiment'),
  humanRiskLabel: riskEnum('human_risk_label'),
  correctedBy: text('corrected_by'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const replyPolicies = pgTable('reply_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  socialAccountId: uuid('social_account_id')
    .references(() => socialAccounts.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  mode: text('mode').notNull().default('shadow'), // shadow | assisted | auto
  autoReplyIntents: intentEnum('auto_reply_intents').array().notNull(),
  minConfidence: real('min_confidence').notNull().default(0.75),
  dailyAutoReplyLimit: integer('daily_auto_reply_limit').notNull().default(200),
  minIntervalSeconds: integer('min_interval_seconds').notNull().default(20),
  activeHours: jsonb('active_hours'), // { start: "08:00", end: "22:00", tz: "Asia/Jakarta" }
  brandVoice: jsonb('brand_voice').notNull(), // { brandName, tone, useEmoji, cta, forbiddenPhrases[] }
  customBlockedKeywords: text('custom_blocked_keywords').array(),
  autoHideSpam: boolean('auto_hide_spam').notNull().default(true)
});

export const replies = pgTable('replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id')
    .references(() => comments.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  draftText: text('draft_text').notNull(),
  finalText: text('final_text'),
  source: replySource('source'),
  externalReplyId: text('external_reply_id'),
  approvedBy: text('approved_by'),
  sentAt: timestamp('sent_at'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0)
});

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(), // classify_comment | generate_reply | send_reply | poll_account | aggregate_daily
    payload: jsonb('payload').notNull(),
    status: jobStatus('status').notNull().default('pending'),
    runAt: timestamp('run_at').defaultNow().notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    dedupeKey: text('dedupe_key').unique()
  },
  (t) => [index('ix_jobs_pick').on(t.status, t.runAt)]
);

export const dailyMetrics = pgTable(
  'daily_metrics',
  {
    workspaceId: uuid('workspace_id').notNull(),
    socialAccountId: uuid('social_account_id').notNull(),
    day: date('day').notNull(),
    total: integer('total').notNull().default(0),
    positive: integer('positive').notNull().default(0),
    neutral: integer('neutral').notNull().default(0),
    negative: integer('negative').notNull().default(0),
    risk: integer('risk').notNull().default(0),
    spam: integer('spam').notNull().default(0),
    autoReplied: integer('auto_replied').notNull().default(0),
    manualReplied: integer('manual_replied').notNull().default(0),
    medianResponseSec: integer('median_response_sec')
  },
  (t) => [uniqueIndex('uq_daily').on(t.socialAccountId, t.day)]
);

export const plans = pgTable('plans', {
  id: text('id').primaryKey(), // starter | growth | agency
  name: text('name').notNull(),
  monthlyAiUnits: integer('monthly_ai_units').notNull(),
  maxSocialAccounts: integer('max_social_accounts').notNull(),
  priceIdr: integer('price_idr').notNull()
});

export const subscriptions = pgTable('subscriptions', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  planId: text('plan_id')
    .references(() => plans.id)
    .notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  extraAiUnits: integer('extra_ai_units').notNull().default(0),
  status: text('status').notNull().default('active') // trial | active | past_due | canceled
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  orderId: text('order_id').notNull().unique(),
  kind: text('kind').notNull(), // subscription | top_up
  planId: text('plan_id').references(() => plans.id),
  aiUnits: integer('ai_units'),
  amountIdr: integer('amount_idr').notNull(),
  status: text('status').notNull().default('pending'), // pending | settlement | expire | cancel | deny | refund
  midtransTransactionId: text('midtrans_transaction_id'),
  paymentType: text('payment_type'),
  rawNotification: jsonb('raw_notification'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    commentId: uuid('comment_id'),
    kind: text('kind').notNull(), // classify | generate_reply
    units: integer('units').notNull().default(1),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costUsdMicros: integer('cost_usd_micros').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (t) => [index('ix_usage_ws_date').on(t.workspaceId, t.createdAt)]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    actor: text('actor').notNull(), // userId | 'system'
    action: text('action').notNull(), // reply.sent, comment.hidden, label.corrected, policy.updated, ...
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (t) => [index('ix_audit_ws').on(t.workspaceId, t.createdAt)]
);
