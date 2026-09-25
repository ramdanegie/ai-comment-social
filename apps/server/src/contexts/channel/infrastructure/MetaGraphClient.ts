// Meta Graph API adapter (PRD FR-2/FR-3). Two ways to reach an Instagram account:
//  - 'facebook_login'  → graph.facebook.com, Page access token (IG must be linked to a Facebook Page).
//  - 'instagram_login' → graph.instagram.com, Instagram User token (no Page needed; instagram_business_* scopes).
// Facebook Pages always use 'facebook_login'.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

export type MetaApi = 'facebook_login' | 'instagram_login';

const baseFor = (api: MetaApi) => (api === 'instagram_login' ? IG_GRAPH_BASE : GRAPH_BASE);

/** Accounts connected through Instagram Login carry instagram_business_* scopes. */
export function metaApiFor(account: { scopes?: string[] | null }): MetaApi {
  return account.scopes?.some((s) => s.startsWith('instagram_business_')) ? 'instagram_login' : 'facebook_login';
}

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly code: number | undefined,
    public readonly subcode: number | undefined,
    public readonly status: number
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }

  /** OAuthException 190 = token expired / revoked / password changed. */
  get isTokenInvalid() {
    return this.code === 190;
  }

  /** 4 / 17 / 32 / 613 = app / user / page rate limit. */
  get isRateLimited() {
    return [4, 17, 32, 613].includes(this.code ?? -1);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

async function graph<T>(method: 'GET' | 'POST', path: string, params: Params, base = GRAPH_BASE): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }

  const url = method === 'GET' ? `${base}${path}?${search}` : `${base}${path}`;
  const res = await fetch(url, {
    method,
    body: method === 'POST' ? search : undefined,
    signal: AbortSignal.timeout(15_000)
  });

  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new MetaGraphError(e.message ?? `Graph API HTTP ${res.status}`, e.code, e.error_subcode, res.status);
  }
  return json as T;
}

// ---------- Types ----------

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
}

export interface NormalizedPost {
  externalId: string;
  caption: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  publishedAt: Date | null;
}

export interface NormalizedComment {
  externalId: string;
  text: string;
  authorName: string | null;
  authorExternalId: string | null;
  commentedAt: Date;
}

// ---------- Auth / discovery ----------

export async function exchangeForLongLivedUserToken(shortLivedToken: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('META_APP_ID and META_APP_SECRET are required');

  return graph<{ access_token: string; token_type: string; expires_in?: number }>('GET', '/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken
  });
}

/** Pages the user manages + linked IG Professional account. Page tokens derived from a long-lived user token do not expire. */
export async function listPagesWithInstagram(userToken: string): Promise<MetaPage[]> {
  const res = await graph<{ data: MetaPage[] }>('GET', '/me/accounts', {
    fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}',
    limit: 100,
    access_token: userToken
  });
  return res.data;
}

// ---------- Instagram ----------

export async function listInstagramMedia(
  igUserId: string,
  token: string,
  limit = 20,
  api: MetaApi = 'facebook_login'
): Promise<NormalizedPost[]> {
  const res = await graph<{ data: any[] }>(
    'GET',
    `/${igUserId}/media`,
    { fields: 'id,caption,permalink,media_url,thumbnail_url,timestamp', limit, access_token: token },
    baseFor(api)
  );
  return res.data.map((m) => ({
    externalId: m.id,
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    mediaUrl: m.thumbnail_url ?? m.media_url ?? null,
    publishedAt: m.timestamp ? new Date(m.timestamp) : null
  }));
}

/** Top-level comments only; replies (including our own) are not ingested. */
export async function listInstagramComments(
  mediaId: string,
  token: string,
  limit = 50,
  api: MetaApi = 'facebook_login'
): Promise<NormalizedComment[]> {
  const res = await graph<{ data: any[] }>(
    'GET',
    `/${mediaId}/comments`,
    { fields: 'id,text,username,timestamp,from{id,username}', limit, access_token: token },
    baseFor(api)
  );
  return res.data.map((c) => ({
    externalId: c.id,
    text: c.text ?? '',
    authorName: c.from?.username ?? c.username ?? null,
    authorExternalId: c.from?.id ?? null,
    commentedAt: new Date(c.timestamp)
  }));
}

export async function replyToInstagramComment(commentId: string, message: string, token: string, api: MetaApi = 'facebook_login') {
  return graph<{ id: string }>('POST', `/${commentId}/replies`, { message, access_token: token }, baseFor(api));
}

export async function hideInstagramComment(commentId: string, hide: boolean, token: string, api: MetaApi = 'facebook_login') {
  return graph<{ success: boolean }>('POST', `/${commentId}`, { hide, access_token: token }, baseFor(api));
}

// ---------- Instagram Login (graph.instagram.com) ----------

/** Profile of the IG professional account behind an Instagram User token. */
export async function getInstagramLoginProfile(token: string) {
  const res = await graph<any>(
    'GET',
    '/me',
    { fields: 'user_id,username,profile_picture_url', access_token: token },
    IG_GRAPH_BASE
  );
  const me = Array.isArray(res.data) ? res.data[0] : res;
  return { userId: String(me.user_id ?? me.id), username: me.username as string, avatarUrl: me.profile_picture_url as string | undefined };
}

/** Short-lived (1h, from Business Login) → long-lived (60d). Tokens generated in the App Dashboard are already long-lived. */
export async function exchangeInstagramToken(shortLivedToken: string) {
  const secret = process.env.META_IG_APP_SECRET;
  if (!secret) throw new Error('META_IG_APP_SECRET is required to exchange Instagram tokens');
  return graph<{ access_token: string; expires_in: number }>(
    'GET',
    '/access_token',
    { grant_type: 'ig_exchange_token', client_secret: secret, access_token: shortLivedToken },
    'https://graph.instagram.com'
  );
}

/** Long-lived token must be ≥24h old and unexpired; returns a fresh 60-day token. */
export async function refreshInstagramToken(longLivedToken: string) {
  return graph<{ access_token: string; expires_in: number }>(
    'GET',
    '/refresh_access_token',
    { grant_type: 'ig_refresh_token', access_token: longLivedToken },
    'https://graph.instagram.com'
  );
}

// ---------- Facebook Page ----------

export async function listPagePosts(pageId: string, token: string, limit = 20): Promise<NormalizedPost[]> {
  const res = await graph<{ data: any[] }>('GET', `/${pageId}/published_posts`, {
    fields: 'id,message,permalink_url,full_picture,created_time',
    limit,
    access_token: token
  });
  return res.data.map((p) => ({
    externalId: p.id,
    caption: p.message ?? null,
    permalink: p.permalink_url ?? null,
    mediaUrl: p.full_picture ?? null,
    publishedAt: p.created_time ? new Date(p.created_time) : null
  }));
}

/** `from` is only returned with pages_read_user_content; may be missing for non-role users in dev mode. */
export async function listPageComments(postId: string, token: string, limit = 50): Promise<NormalizedComment[]> {
  const res = await graph<{ data: any[] }>('GET', `/${postId}/comments`, {
    fields: 'id,message,created_time,from{id,name}',
    filter: 'toplevel',
    order: 'reverse_chronological',
    limit,
    access_token: token
  });
  return res.data.map((c) => ({
    externalId: c.id,
    text: c.message ?? '',
    authorName: c.from?.name ?? null,
    authorExternalId: c.from?.id ?? null,
    commentedAt: new Date(c.created_time)
  }));
}

export async function replyToPageComment(commentId: string, message: string, token: string) {
  return graph<{ id: string }>('POST', `/${commentId}/comments`, { message, access_token: token });
}

export async function hidePageComment(commentId: string, hide: boolean, token: string) {
  return graph<{ success: boolean }>('POST', `/${commentId}`, { is_hidden: hide, access_token: token });
}

// ---------- Platform-agnostic facade (used by worker) ----------

export type MetaPlatform = 'instagram' | 'facebook';

export const MetaGraph = {
  listPosts: (platform: MetaPlatform, accountExternalId: string, token: string, limit?: number, api?: MetaApi) =>
    platform === 'instagram'
      ? listInstagramMedia(accountExternalId, token, limit, api)
      : listPagePosts(accountExternalId, token, limit),

  listComments: (platform: MetaPlatform, postExternalId: string, token: string, api?: MetaApi) =>
    platform === 'instagram'
      ? listInstagramComments(postExternalId, token, 50, api)
      : listPageComments(postExternalId, token),

  reply: (platform: MetaPlatform, commentExternalId: string, message: string, token: string, api?: MetaApi) =>
    platform === 'instagram'
      ? replyToInstagramComment(commentExternalId, message, token, api)
      : replyToPageComment(commentExternalId, message, token),

  hide: (platform: MetaPlatform, commentExternalId: string, hide: boolean, token: string, api?: MetaApi) =>
    platform === 'instagram'
      ? hideInstagramComment(commentExternalId, hide, token, api)
      : hidePageComment(commentExternalId, hide, token)
};
