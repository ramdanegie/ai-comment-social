import type {
  CommentItem,
  DashboardSummary,
  DailyMetric,
  SocialAccount,
  ReplyPolicy,
  Plan,
  Pricing,
  BillingOverview,
  PaymentItem,
  AuditLogItem,
  UserRole
} from './types';
import { authFetch, setToken } from './authToken';

const API_BASE = typeof window !== 'undefined'
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3099')
  : 'http://127.0.0.1:3099';

export type Me = {
  user: { id: string; name: string; email: string; image?: string | null; isSuperadmin?: boolean };
  workspaces: Array<{ id: string; name: string; slug: string; role: UserRole }>;
};

export const api = {
  authBaseUrl: API_BASE,
  // 1. Workspaces (PostgreSQL workspaces table)
  async getWorkspaces(): Promise<Array<{ id: string; name: string; slug: string; createdAt: string }>> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces`);
    if (!res.ok) throw new Error('Gagal mengambil daftar workspace');
    return await res.json();
  },

  async createWorkspace(name: string): Promise<{ id: string; name: string; slug: string }> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Gagal membuat workspace baru');
    return await res.json();
  },

  // 2. Authentication (Better Auth, bearer token)
  /** Email + password sign-in. Stores the session token and returns the user + their workspaces. */
  async signIn(email: string, password: string): Promise<Me> {
    const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        res.status === 429
          ? 'Terlalu banyak percobaan. Tunggu 1 menit lalu coba lagi.'
          : res.status === 401
            ? 'Email atau kata sandi salah.'
            : err.message || 'Login gagal.'
      );
    }
    const token = res.headers.get('set-auth-token');
    if (!token) throw new Error('Server tidak mengirim token sesi (cek CORS exposeHeaders).');
    setToken(token);
    return this.getMe();
  },

  /** Starts Google OAuth; the API finishes at /api/v1/auth/social-done and returns to /login#token=… */
  async googleSignInUrl(): Promise<string> {
    const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
      method: 'POST',
      credentials: 'include', // OAuth state cookie on the API domain
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', callbackURL: `${API_BASE}/api/v1/auth/social-done` })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.message || 'Login Google belum tersedia.');
    return data.url;
  },

  /** Completes Google sign-in with the session token handed back in the URL fragment. */
  async signInWithToken(token: string): Promise<Me> {
    setToken(token);
    return this.getMe();
  },

  async signOut(): Promise<void> {
    await authFetch(`${API_BASE}/api/auth/sign-out`, { method: 'POST' }).catch(() => {});
  },

  async getMe(): Promise<Me> {
    const res = await authFetch(`${API_BASE}/api/v1/me`);
    if (!res.ok) throw new Error('Sesi tidak valid');
    return await res.json();
  },

  // 3. Workspace Members (PostgreSQL memberships & users join)
  async getMembers(ws: string): Promise<Array<{ id: string; name: string; email: string; avatarUrl?: string; role: string; createdAt?: string }>> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/members`);
    if (!res.ok) throw new Error('Gagal mengambil anggota tim workspace');
    return await res.json();
  },

  async inviteMember(
    ws: string,
    payload: { email: string; role: string; name?: string }
  ): Promise<any> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal menambahkan anggota tim');
    return await res.json();
  },

  // 4. Dashboard Summary & Trends (PostgreSQL comments, classifications & daily_metrics)
  async getSummary(ws: string): Promise<DashboardSummary> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/dashboard/summary`);
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

  async getTrends(ws: string): Promise<DailyMetric[]> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/dashboard/trend`);
    if (!res.ok) return [];
    return await res.json();
  },

  // 5. Comments & Moderation (PostgreSQL comments & classifications)
  async getComments(
    ws: string,
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

    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/comments?${q.toString()}`);
    if (!res.ok) return { items: [], total: 0 };
    return await res.json();
  },

  // 6. Review Queue (PostgreSQL comments where status = 'NEEDS_REVIEW')
  async getReviewQueue(ws: string): Promise<CommentItem[]> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/review`);
    if (!res.ok) return [];
    return await res.json();
  },

  async approveReview(ws: string, commentId: string, text?: string): Promise<boolean> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return res.ok;
  },

  async regenerateReview(ws: string, commentId: string): Promise<string> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/regenerate`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Gagal regenerate balasan dari server AI');
    const data = await res.json();
    return data.draftText;
  },

  async hideReview(ws: string, commentId: string): Promise<boolean> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/hide`, {
      method: 'POST'
    });
    return res.ok;
  },

  async dismissReview(ws: string, commentId: string): Promise<boolean> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/review/${commentId}/dismiss`, {
      method: 'POST'
    });
    return res.ok;
  },

  async correctLabel(ws: string, commentId: string, sentiment: string, riskLabel: string): Promise<boolean> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/comments/${commentId}/label`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentiment, riskLabel })
    });
    return res.ok;
  },

  // 7. Social Accounts (PostgreSQL social_accounts & reply_policies)
  async getAccounts(ws: string): Promise<SocialAccount[]> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts`);
    if (!res.ok) return [];
    return await res.json();
  },


  async disconnectAccount(ws: string, accountId: string): Promise<boolean> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}`, {
      method: 'DELETE'
    });
    return res.ok;
  },

  /** Instagram Login: authorize URL (with signed state) for the "Hubungkan Instagram" button. */
  async getInstagramConnectUrl(ws: string): Promise<{ url: string; redirectUri: string }> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/connect/instagram`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan koneksi Instagram');
    return data;
  },

  /** Exchange the ?code from Instagram's redirect and connect the account. */
  async connectInstagram(ws: string, code: string, state?: string): Promise<SocialAccount> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/connect/instagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghubungkan Instagram');
    return data.account;
  },

  // Facebook Pages (Facebook Login): URL → ?code → pick Pages
  async getFacebookConnectUrl(ws: string): Promise<{ url: string; redirectUri: string }> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/connect/facebook`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan koneksi Facebook');
    return data;
  },

  async exchangeFacebookCode(
    ws: string,
    code: string,
    state: string
  ): Promise<{ ticket: string; pages: Array<{ id: string; name: string; pictureUrl: string | null; instagramUsername: string | null }> }> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/connect/facebook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membaca Facebook Page');
    return data;
  },

  async connectFacebookPages(ws: string, ticket: string, pageIds: string[]): Promise<SocialAccount[]> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/connect/facebook/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, pageIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghubungkan Facebook Page');
    return data.accounts;
  },

  /** Queue an immediate poll of the account's latest posts/comments. */
  async syncAccount(ws: string, accountId: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}/sync`, { method: 'POST' });
    if (!res.ok) throw new Error('Gagal memulai sinkronisasi');
  },

  async getPolicy(ws: string, accountId: string): Promise<ReplyPolicy> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}/policy`);
    if (!res.ok) throw new Error('Gagal mengambil konfigurasi aturan');
    return await res.json();
  },

  async updatePolicy(ws: string, accountId: string, policy: ReplyPolicy): Promise<ReplyPolicy> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy)
    });
    if (!res.ok) throw new Error('Gagal memperbarui aturan');
    return await res.json();
  },

  async previewPolicy(
    ws: string,
    accountId: string,
    payload: {
      sampleComment: string;
      sampleAuthor?: string;
      samplePostCaption?: string;
      mode: string;
      autoReplyIntents: string[];
      minConfidence: number;
      brandVoice: any;
      customBlockedKeywords?: string[];
      autoHideSpam: boolean;
    }
  ) {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/accounts/${accountId}/policy/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal menjalankan simulasi preview aturan');
    return await res.json();
  },

  // 8. Reports & Analytics (PostgreSQL daily_metrics & posts)
  async getReports(ws: string, period: string = 'daily') {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/reports?period=${period}`);
    if (!res.ok) return { period, metrics: [], topPosts: [] };
    return await res.json();
  },

  exportCsvUrl(ws: string): string {
    return `${API_BASE}/api/v1/workspaces/${ws}/reports/export.csv`;
  },

  // 9. Billing, Plans & Payments (PostgreSQL plans, subscriptions, payments)
  async getPricing(): Promise<Pricing> {
    const res = await authFetch(`${API_BASE}/api/v1/pricing`);
    if (!res.ok) throw new Error('Gagal mengambil daftar harga');
    return await res.json();
  },

  async getBilling(ws: string): Promise<BillingOverview> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/billing`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal mengambil data billing');
    return await res.json();
  },

  /** Creates a Midtrans Snap transaction; the caller redirects to `redirectUrl`. */
  async checkout(
    ws: string,
    payload: { kind: 'subscription'; planId: string } | { kind: 'top_up'; packageId: string }
  ): Promise<{ orderId: string; redirectUrl: string; amountIdr: number }> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Gagal membuat transaksi');
    return data;
  },

  async syncPayment(ws: string, orderId: string): Promise<{ status?: string }> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/billing/payments/${encodeURIComponent(orderId)}/sync`, { method: 'POST' });
    return await res.json().catch(() => ({}));
  },

  /** Public sign-up (trial workspace). Call signIn() afterwards. */
  async register(payload: { name: string; email: string; password: string; brandName: string }): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || (res.status === 422 ? 'Periksa kembali isian formulir.' : 'Pendaftaran gagal'));
    }
  },

  // Superadmin (platform operator)
  admin: {
    async get<T>(path: string): Promise<T> {
      const res = await authFetch(`${API_BASE}/api/v1/admin${path}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Gagal memuat ${path}`);
      return await res.json();
    },
    async send<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
      const res = await authFetch(`${API_BASE}/api/v1/admin${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Gagal menyimpan');
      return data;
    }
  },


  // 10. Audit Logs (PostgreSQL audit_logs)
  async getAuditLogs(ws: string): Promise<AuditLogItem[]> {
    const res = await authFetch(`${API_BASE}/api/v1/workspaces/${ws}/audit-logs`);
    if (!res.ok) return [];
    return await res.json();
  }
};
