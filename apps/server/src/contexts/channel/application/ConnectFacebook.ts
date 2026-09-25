// Use case: connect Facebook Pages through Facebook Login (for Business).
// Flow: auth URL → redirect with ?code → exchange for a long-lived user token → list Pages →
// the owner picks Pages → Page tokens (non-expiring when derived from a long-lived user token) are stored.
// The Page list and tokens never reach the browser: it only holds an encrypted, short-lived ticket.

import { db, schema } from '@replyra/db';
import { decryptTokenStrict, encryptToken } from '../../../shared/infrastructure/crypto';
import { exchangeForLongLivedUserToken, listPagesWithInstagram } from '../infrastructure/MetaGraphClient';
import { createState, ensureDefaultPolicy } from './ConnectInstagram';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const TICKET_TTL_MS = 15 * 60 * 1000;

/** Read + reply/hide comments on Pages. business_management: Pages owned by a Business portfolio. */
export const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_manage_engagement',
  'business_management'
];

function config() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const webUrl = (process.env.WEB_URL || (process.env.WEB_ORIGINS || '').split(',')[0] || '').trim().replace(/\/$/, '');
  const redirectUri = process.env.META_FB_REDIRECT_URI || (webUrl ? `${webUrl}/accounts/facebook/callback` : '');
  if (!appId || !appSecret || !redirectUri) {
    throw new Error('META_APP_ID, META_APP_SECRET and META_FB_REDIRECT_URI (or WEB_URL) must be set');
  }
  return { appId, appSecret, redirectUri, configId: process.env.META_FB_CONFIG_ID };
}

export function buildFacebookAuthUrl(workspaceSlug: string) {
  const { appId, redirectUri, configId } = config();
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', createState(workspaceSlug));
  // Business apps use a Facebook Login for Business configuration; classic apps use scopes.
  if (configId) url.searchParams.set('config_id', configId);
  else url.searchParams.set('scope', FACEBOOK_SCOPES.join(','));
  return { url: url.toString(), redirectUri };
}

export interface PageChoice {
  id: string;
  name: string;
  pictureUrl: string | null;
  instagramUsername: string | null;
}

interface Ticket {
  ws: string;
  exp: number;
  pages: Array<PageChoice & { token: string }>;
}

/** Code → long-lived user token → Pages the user manages. Returns choices + an encrypted ticket. */
export async function exchangeFacebookCode(workspaceSlug: string, code: string) {
  const { appId, appSecret, redirectUri } = config();
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code.trim().replace(/#_=_$/, ''));

  const res = (await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).json()) as any;
  if (!res.access_token) {
    const msg: string = res.error?.message ?? 'Unknown error';
    if (/redirect_uri/i.test(msg)) throw new Error(`Redirect URI mismatch — harus ${redirectUri} (META_FB_REDIRECT_URI)`);
    if (/been used|expired/i.test(msg)) throw new Error('Kode sudah dipakai atau kedaluwarsa — ulangi dari tombol Hubungkan Facebook');
    throw new Error(`Facebook code exchange failed: ${msg}`);
  }

  const long = await exchangeForLongLivedUserToken(res.access_token);
  const pages = await listPagesWithInstagram(long.access_token);
  if (!pages.length) {
    throw new Error('Tidak ada Facebook Page yang bisa diakses. Pastikan Anda admin Page dan memilih Page tersebut saat login.');
  }

  const ticket: Ticket = {
    ws: workspaceSlug,
    exp: Date.now() + TICKET_TTL_MS,
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      pictureUrl: p.picture?.data?.url ?? null,
      instagramUsername: p.instagram_business_account?.username ?? null,
      token: p.access_token
    }))
  };
  return {
    ticket: encryptToken(JSON.stringify(ticket)),
    pages: ticket.pages.map(({ token: _t, ...choice }) => choice)
  };
}

function openTicket(ticket: string, workspaceSlug: string): Ticket {
  let data: Ticket;
  try {
    data = JSON.parse(decryptTokenStrict(ticket));
  } catch {
    throw new Error('Sesi pemilihan Page tidak valid — ulangi Hubungkan Facebook');
  }
  if (data.ws !== workspaceSlug) throw new Error('Sesi pemilihan Page milik workspace lain');
  if (Date.now() > data.exp) throw new Error('Sesi pemilihan Page kedaluwarsa — ulangi Hubungkan Facebook');
  return data;
}

/** Upsert the chosen Pages as social accounts (idempotent per Page) with a Shadow-mode policy. */
export async function connectFacebookPages(workspaceId: string, workspaceSlug: string, ticket: string, pageIds: string[]) {
  const { pages } = openTicket(ticket, workspaceSlug);
  const chosen = pages.filter((p) => pageIds.includes(p.id));
  if (!chosen.length) throw new Error('Pilih minimal satu Page');

  const accounts = [];
  for (const page of chosen) {
    const values = {
      workspaceId,
      platform: 'facebook' as const,
      externalId: page.id,
      username: page.name,
      avatarUrl: page.pictureUrl,
      accessTokenEnc: encryptToken(page.token),
      tokenExpiresAt: null,
      scopes: FACEBOOK_SCOPES,
      status: 'connected'
    };
    const [account] = await db
      .insert(schema.socialAccounts)
      .values(values)
      .onConflictDoUpdate({ target: [schema.socialAccounts.platform, schema.socialAccounts.externalId], set: values })
      .returning();
    await ensureDefaultPolicy(account.id, page.name);
    accounts.push(account);
  }
  return accounts;
}
