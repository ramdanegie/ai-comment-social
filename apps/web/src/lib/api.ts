import type {
  CommentItem,
  DashboardSummary,
  DailyMetric,
  SocialAccount,
  ReplyPolicy,
  Plan,
  PaymentItem,
  AuditLogItem,
  UserRole
} from './types';

const API_BASE = typeof window !== 'undefined'
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3099')
  : 'http://127.0.0.1:3099';

export const api = {
  // 1. Workspaces (PostgreSQL workspaces table)
  async getWorkspaces(): Promise<Array<{ id: string; name: string; slug: string; createdAt: string }>> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces`);
    if (!res.ok) throw new Error('Gagal mengambil daftar workspace');
    return await res.json();
  },

  async createWorkspace(name: string): Promise<{ id: string; name: string; slug: string }> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Gagal membuat workspace baru');
    return await res.json();
  },

  // 2. Users & Authentication (PostgreSQL users & memberships tables)
  async getUsers(): Promise<Array<{ id: string; name: string; email: string; avatarUrl?: string; role?: UserRole; workspaceSlug?: string }>> {
    const res = await fetch(`${API_BASE}/api/v1/users`);
    if (!res.ok) throw new Error('Gagal mengambil data pengguna');
    return await res.json();
  },

  async login(email: string, password?: string): Promise<{ user: any; role: UserRole; token: string }> {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Autentikasi gagal. Akun tidak ditemukan.');
    }
    return await res.json();
  },

  async loginWithGoogle(payload?: { email?: string; name?: string; avatarUrl?: string; credential?: string }): Promise<{ user: any; role: UserRole; token: string }> {
    const res = await fetch(`${API_BASE}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Autentikasi Google gagal. Silakan coba lagi.');
    }
    return await res.json();
  },

  async getCurrentUser(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`);
    if (!res.ok) throw new Error('Gagal mengambil konteks user');
    return await res.json();
  },

  // 3. Workspace Members (PostgreSQL memberships & users join)
  async getMembers(ws: string = 'maujahit'): Promise<Array<{ id: string; name: string; email: string; avatarUrl?: string; role: string; createdAt?: string }>> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/members`);
    if (!res.ok) throw new Error('Gagal mengambil anggota tim workspace');
    return await res.json();
  },

  async inviteMember(
    ws: string = 'maujahit',
    payload: { email: string; role: string; name?: string }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal menambahkan anggota tim');
    return await res.json();
  },

  // 4. Dashboard Summary & Trends (PostgreSQL comments, classifications & daily_metrics)
  async getSummary(ws: string = 'maujahit'): Promise<DashboardSummary> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/dashboard/summary`);
    if (!res.ok) {
      return {
        total: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        risk: 0,
        spam: 0,
        aiActivity: { autoReplied: 0, needsReview: 0, queued: 0, hidden: 0 },
        medianResponseSec: 0,
        responseTimeText: '-'
      };
    }
    return await res.json();
  },

  async getTrends(ws: string = 'maujahit'): Promise<DailyMetric[]> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/dashboard/trend`);
    if (!res.ok) return [];
    return await res.json();
  },

  // 5. Comments & Moderation (PostgreSQL comments & classifications)
  async getComments(
    ws: string = 'maujahit',
    filters?: {
      platform?: string;
      sentiment?: string;
      risk?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: CommentItem[]; total: number }> {
    const q = new URLSearchParams();
    if (filters?.platform) q.set('platform', filters.platform);
    if (filters?.sentiment) q.set('sentiment', filters.sentiment);
    if (filters?.risk) q.set('risk', filters.risk);
    if (filters?.status) q.set('status', filters.status);
    if (filters?.search) q.set('search', filters.search);
    if (filters?.limit) q.set('limit', String(filters.limit));
    if (filters?.offset) q.set('offset', String(filters.offset));

    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/comments?${q.toString()}`);
    if (!res.ok) return { items: [], total: 0 };
    return await res.json();
  },

  // 6. Review Queue (PostgreSQL comments where status = 'NEEDS_REVIEW')
  async getReviewQueue(ws: string = 'maujahit'): Promise<CommentItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/review`);
    if (!res.ok) return [];
    return await res.json();
  },

  async approveReview(ws: string = 'maujahit', commentId: string, text?: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return res.ok;
  },

  async regenerateReview(ws: string = 'maujahit', commentId: string): Promise<string> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/regenerate`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Gagal regenerate balasan dari server AI');
    const data = await res.json();
    return data.draftText;
  },

  async hideReview(ws: string = 'maujahit', commentId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/hide`, {
      method: 'POST'
    });
    return res.ok;
  },

  async dismissReview(ws: string = 'maujahit', commentId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/dismiss`, {
      method: 'POST'
    });
    return res.ok;
  },

  async correctLabel(ws: string = 'maujahit', commentId: string, sentiment: string, riskLabel: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/comments/${commentId}/label`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentiment, riskLabel })
    });
    return res.ok;
  },

  // 7. Social Accounts (PostgreSQL social_accounts & reply_policies)
  async getAccounts(ws: string = 'maujahit'): Promise<SocialAccount[]> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts`);
    if (!res.ok) return [];
    return await res.json();
  },

  async connectAccount(
    ws: string = 'maujahit',
    payload: { platform: string; externalId: string; username: string; accessToken: string; avatarUrl?: string }
  ): Promise<SocialAccount> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/connect/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal menghubungkan akun media sosial');
    return await res.json();
  },

  async disconnectAccount(ws: string = 'maujahit', accountId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}`, {
      method: 'DELETE'
    });
    return res.ok;
  },

  async getPolicy(ws: string = 'maujahit', accountId: string): Promise<ReplyPolicy> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}/policy`);
    if (!res.ok) throw new Error('Gagal mengambil konfigurasi aturan');
    return await res.json();
  },

  async updatePolicy(ws: string = 'maujahit', accountId: string, policy: ReplyPolicy): Promise<ReplyPolicy> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy)
    });
    if (!res.ok) throw new Error('Gagal memperbarui aturan');
    return await res.json();
  },

  async previewPolicy(
    ws: string = 'maujahit',
    accountId: string,
    payload: {
      sampleComment: string;
      sampleAuthor?: string;
      mode: string;
      autoReplyIntents: string[];
      minConfidence: number;
      brandVoice: any;
      customBlockedKeywords?: string[];
      autoHideSpam: boolean;
    }
  ) {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}/policy/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal menjalankan simulasi preview aturan');
    return await res.json();
  },

  // 8. Reports & Analytics (PostgreSQL daily_metrics & posts)
  async getReports(ws: string = 'maujahit', period: string = 'daily') {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/reports?period=${period}`);
    if (!res.ok) return { period, metrics: [], topPosts: [] };
    return await res.json();
  },

  exportCsvUrl(ws: string = 'maujahit'): string {
    return `${API_BASE}/api/v1/workspaces/${ws}/reports/export.csv`;
  },

  // 9. Billing, Plans & Payments (PostgreSQL plans, subscriptions, payments)
  async getPlans(): Promise<Plan[]> {
    const res = await fetch(`${API_BASE}/api/v1/plans`);
    if (!res.ok) return [];
    return await res.json();
  },

  async getBilling(ws: string = 'maujahit') {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/billing`);
    if (!res.ok) {
      return {
        subscription: null,
        plan: null,
        usedUnits: 0,
        totalUnits: 0,
        percentUsed: 0,
        paymentHistory: []
      };
    }
    return await res.json();
  },

  async checkout(ws: string = 'maujahit', payload: { kind: string; planId?: string; aiUnits?: number }) {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal memproses transaksi checkout');
    return await res.json();
  },

  // 10. Audit Logs (PostgreSQL audit_logs)
  async getAuditLogs(ws: string = 'maujahit'): Promise<AuditLogItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/workspaces/${ws}/audit-logs`);
    if (!res.ok) return [];
    return await res.json();
  }
};
