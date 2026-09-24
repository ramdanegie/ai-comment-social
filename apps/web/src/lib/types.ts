export type Platform = 'instagram' | 'facebook' | 'tiktok';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type RiskLabel = 'none' | 'spam' | 'toxic' | 'hate' | 'threat' | 'sensitive';
export type Intent = 'praise' | 'purchase_intent' | 'question' | 'complaint' | 'other';
export type CommentStatus =
  | 'RECEIVED'
  | 'CLASSIFIED'
  | 'AUTO_REPLY_QUEUED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REPLIED'
  | 'HIDDEN'
  | 'DISMISSED'
  | 'IGNORED'
  | 'FAILED';
export type ReplySource = 'auto' | 'human_approved' | 'human_written';
export type UserRole = 'owner' | 'admin' | 'viewer';
export type PolicyMode = 'shadow' | 'assisted' | 'auto';

export interface Classification {
  id: string;
  sentiment: Sentiment;
  riskLabel: RiskLabel;
  intent: Intent;
  confidence: number;
  reason?: string;
  prefilterHits?: string[];
  humanSentiment?: Sentiment;
  humanRiskLabel?: RiskLabel;
  correctedBy?: string;
}

export interface Reply {
  id: string;
  draftText: string;
  finalText?: string;
  source?: ReplySource;
  sentAt?: string;
}

export interface PostContext {
  id: string;
  externalId: string;
  caption: string;
  permalink?: string;
  mediaUrl?: string;
  publishedAt?: string;
}

export interface CommentItem {
  id: string;
  workspaceId: string;
  socialAccountId: string;
  postId?: string;
  platform: Platform;
  externalId: string;
  authorName: string;
  text: string;
  commentedAt: string;
  status: CommentStatus;
  classification?: Classification;
  reply?: Reply;
  post?: PostContext;
  account?: {
    username: string;
    platform: Platform;
  };
}

export interface SocialAccount {
  id: string;
  workspaceId: string;
  platform: Platform;
  externalId: string;
  username: string;
  avatarUrl?: string;
  status: 'connected' | 'expired' | 'revoked' | 'pending_approval';
  scopes?: string[];
  lastSyncedAt?: string;
  policy?: ReplyPolicy;
}

export interface BrandVoice {
  brandName: string;
  tone: string;
  useEmoji: boolean;
  cta: string;
  forbiddenPhrases: string[];
}

export interface ReplyPolicy {
  id?: string;
  socialAccountId: string;
  mode: PolicyMode;
  autoReplyIntents: Intent[];
  minConfidence: number;
  dailyAutoReplyLimit: number;
  minIntervalSeconds: number;
  activeHours: { start: string; end: string; tz: string };
  brandVoice: BrandVoice;
  customBlockedKeywords: string[];
  autoHideSpam: boolean;
}

export interface DashboardSummary {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  risk: number;
  spam: number;
  aiActivity: {
    autoReplied: number;
    needsReview: number;
    queued: number;
    hidden: number;
  };
  medianResponseSec: number;
  responseTimeText: string;
}

export interface DailyMetric {
  day: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  risk: number;
  spam: number;
  autoReplied: number;
  manualReplied: number;
}

export interface Plan {
  id: string;
  name: string;
  monthlyAiUnits: number;
  maxSocialAccounts: number;
  priceIdr: number;
}

export interface Subscription {
  workspaceId: string;
  planId: string;
  periodStart: string;
  periodEnd: string;
  extraAiUnits: number;
  status: 'trial' | 'active' | 'past_due' | 'canceled';
}

export interface PaymentItem {
  id: string;
  orderId: string;
  kind: 'subscription' | 'top_up';
  amountIdr: number;
  status: 'pending' | 'settlement' | 'expire' | 'cancel';
  paymentType?: string;
  paidAt?: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: any;
  createdAt: string;
}
