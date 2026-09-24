// Meta Graph API adapter — Instagram API with Facebook Login + Facebook Pages API (PRD FR-2/FR-3).
// Host: graph.facebook.com. Tokens: Page access token (works for both the Page and its linked IG account).

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

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

async function graph<T>(method: 'GET' | 'POST', path: string, params: Params): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }

  const url = method === 'GET' ? `${GRAPH_BASE}${path}?${search}` : `${GRAPH_BASE}${path}`;
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

export async function listInstagramMedia(igUserId: string, token: string, limit = 20): Promise<NormalizedPost[]> {
  const res = await graph<{ data: any[] }>('GET', `/${igUserId}/media`, {
    fields: 'id,caption,permalink,media_url,thumbnail_url,timestamp',
    limit,
    access_token: token
  });
  return res.data.map((m) => ({
    externalId: m.id,
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    mediaUrl: m.thumbnail_url ?? m.media_url ?? null,
    publishedAt: m.timestamp ? new Date(m.timestamp) : null
  }));
}

/** Top-level comments only; replies (including our own) are not ingested. */
export async function listInstagramComments(mediaId: string, token: string, limit = 50): Promise<NormalizedComment[]> {
  const res = await graph<{ data: any[] }>('GET', `/${mediaId}/comments`, {
    fields: 'id,text,username,timestamp,from{id,username}',
    limit,
    access_token: token
  });
  return res.data.map((c) => ({
    externalId: c.id,
    text: c.text ?? '',
    authorName: c.from?.username ?? c.username ?? null,
    authorExternalId: c.from?.id ?? null,
    commentedAt: new Date(c.timestamp)
  }));
}

export async function replyToInstagramComment(commentId: string, message: string, token: string) {
  return graph<{ id: string }>('POST', `/${commentId}/replies`, { message, access_token: token });
}

export async function hideInstagramComment(commentId: string, hide: boolean, token: string) {
  return graph<{ success: boolean }>('POST', `/${commentId}`, { hide, access_token: token });
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
  listPosts: (platform: MetaPlatform, accountExternalId: string, token: string, limit?: number) =>
    platform === 'instagram'
      ? listInstagramMedia(accountExternalId, token, limit)
      : listPagePosts(accountExternalId, token, limit),

  listComments: (platform: MetaPlatform, postExternalId: string, token: string) =>
    platform === 'instagram' ? listInstagramComments(postExternalId, token) : listPageComments(postExternalId, token),

  reply: (platform: MetaPlatform, commentExternalId: string, message: string, token: string) =>
    platform === 'instagram'
      ? replyToInstagramComment(commentExternalId, message, token)
      : replyToPageComment(commentExternalId, message, token),

  hide: (platform: MetaPlatform, commentExternalId: string, hide: boolean, token: string) =>
    platform === 'instagram'
      ? hideInstagramComment(commentExternalId, hide, token)
      : hidePageComment(commentExternalId, hide, token)
};
