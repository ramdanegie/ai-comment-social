// Use case: connect an Instagram Professional account through Instagram Login (no Facebook Page).
// Shared by the HTTP API (/accounts → "Hubungkan Instagram") and scripts/meta-dev.ts.

import crypto from 'node:crypto';
import { db, schema } from '@replyra/db';
import { encryptToken } from '../../../shared/infrastructure/crypto';
import { exchangeInstagramToken, getInstagramLoginProfile } from '../infrastructure/MetaGraphClient';

export const INSTAGRAM_LOGIN_SCOPES = ['instagram_business_basic', 'instagram_business_manage_comments'];
const STATE_TTL_MS = 15 * 60 * 1000;

function config() {
  const appId = process.env.META_IG_APP_ID;
  const appSecret = process.env.META_IG_APP_SECRET;
  const redirectUri = process.env.META_IG_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error('META_IG_APP_ID, META_IG_APP_SECRET and META_IG_REDIRECT_URI must be set');
  }
  return { appId, appSecret, redirectUri };
}

// ---------- OAuth state (CSRF + which workspace started the flow) ----------

const stateKey = () => {
  const key = process.env.TOKEN_ENCRYPTION_KEY || process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET;
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY must be set');
  return key;
};
const sign = (payload: string) => crypto.createHmac('sha256', stateKey()).update(payload).digest('base64url');

export function createState(workspaceSlug: string): string {
  const payload = Buffer.from(
    JSON.stringify({ ws: workspaceSlug, exp: Date.now() + STATE_TTL_MS, n: crypto.randomBytes(8).toString('hex') })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns the workspace slug the flow was started for, or throws. */
export function verifyState(state: string): string {
  const [payload, sig] = state.split('.');
  const expected = payload ? sign(payload) : '';
  if (!payload || !sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid OAuth state');
  }
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (Date.now() > data.exp) throw new Error('OAuth state expired — start the connection again');
  return data.ws as string;
}

export function buildInstagramAuthUrl(workspaceSlug: string) {
  const { appId, redirectUri } = config();
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', INSTAGRAM_LOGIN_SCOPES.join(','));
  url.searchParams.set('state', createState(workspaceSlug));
  return { url: url.toString(), redirectUri };
}

// ---------- Code → token → account ----------

/** Authorization code (1h, single use) → long-lived Instagram User token (60 days). */
export async function exchangeInstagramCode(code: string) {
  const { appId, appSecret, redirectUri } = config();
  const form = new FormData();
  form.set('client_id', appId);
  form.set('client_secret', appSecret);
  form.set('grant_type', 'authorization_code');
  form.set('redirect_uri', redirectUri);
  form.set('code', code.trim().replace(/#_$/, ''));

  const res = (await (await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })).json()) as any;
  const data = Array.isArray(res.data) ? res.data[0] : res;
  if (!data?.access_token) {
    const msg: string = res.error_message ?? res.error?.message ?? 'Unknown error';
    if (/redirect_uri/i.test(msg)) {
      throw new Error(`Redirect URI mismatch — the code must come from ${redirectUri} (META_IG_REDIRECT_URI)`);
    }
    if (/been used|expired|invalid/i.test(msg)) throw new Error('Kode sudah dipakai atau kedaluwarsa — ulangi dari tombol Hubungkan Instagram');
    throw new Error(`Instagram code exchange failed: ${msg}`);
  }

  const granted: string[] = Array.isArray(data.permissions) ? data.permissions : String(data.permissions ?? '').split(',');
  if (!granted.includes('instagram_business_manage_comments')) {
    throw new Error('Izin "manage comments" tidak diberikan — ulangi dan centang semua izin');
  }

  const long = await exchangeInstagramToken(data.access_token);
  return { token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000) };
}

/** Upsert the IG account (idempotent per IG user) and create a Shadow-mode policy on first connect. */
export async function connectInstagramAccount(workspaceId: string, token: string, expiresAt: Date) {
  const me = await getInstagramLoginProfile(token);
  const values = {
    workspaceId,
    platform: 'instagram' as const,
    externalId: me.userId,
    username: me.username,
    avatarUrl: me.avatarUrl,
    accessTokenEnc: encryptToken(token),
    tokenExpiresAt: expiresAt,
    scopes: INSTAGRAM_LOGIN_SCOPES,
    status: 'connected'
  };

  const [account] = await db
    .insert(schema.socialAccounts)
    .values(values)
    .onConflictDoUpdate({ target: [schema.socialAccounts.platform, schema.socialAccounts.externalId], set: values })
    .returning();

  await ensureDefaultPolicy(account.id, me.username);
  return account;
}

/** First connect only: Shadow-mode policy (PRD §10.1 — nothing is sent until the owner changes the mode). */
export async function ensureDefaultPolicy(socialAccountId: string, brandName: string) {
  await db
    .insert(schema.replyPolicies)
    .values({
      socialAccountId,
      mode: 'shadow',
      autoReplyIntents: ['praise', 'purchase_intent'],
      minConfidence: 0.8,
      customBlockedKeywords: [],
      brandVoice: { brandName, tone: 'Ramah dan profesional', useEmoji: true, cta: 'Silakan DM kami ya kak!', forbiddenPhrases: [] }
    })
    .onConflictDoNothing({ target: schema.replyPolicies.socialAccountId });
}
