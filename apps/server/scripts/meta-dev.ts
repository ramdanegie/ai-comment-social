#!/usr/bin/env bun
// Dev-mode helper for Meta (Jalur A): works for assets owned by users with an App Role, no App Review needed.
//
//   bun scripts/meta-dev.ts pages      <user_token>              → list Pages + linked IG accounts
//   bun scripts/meta-dev.ts connect    <workspace> <user_token>  → exchange to long-lived, save Page + IG accounts
//   bun scripts/meta-dev.ts connect-ig <workspace> <ig_token>    → Instagram Login token (no Facebook Page needed)
//   bun scripts/meta-dev.ts connect-ig-code <workspace> <code>   → exchange ?code= from Instagram business login redirect, then connect
//   bun scripts/meta-dev.ts poll    <social_account_id>       → poll once now (no worker needed)
//   bun scripts/meta-dev.ts comments <social_account_id>      → print latest remote posts + comments (read-only)
//
// <user_token> = short-lived User Token from Graph API Explorer (or already long-lived).
// <ig_token>   = Instagram User token from App Dashboard → Instagram use case → Generate token (60 days).
// Tokens can also be passed via META_TOKEN=... to keep them out of shell history.

import { db, schema, client } from '@replyra/db';
import { eq } from 'drizzle-orm';
import {
  exchangeForLongLivedUserToken,
  exchangeInstagramToken,
  listPagesWithInstagram,
  metaApiFor,
  MetaGraph,
  type MetaPage
} from '../src/contexts/channel/infrastructure/MetaGraphClient';
import { isMetaPlatform, pollAccount } from '../src/contexts/engagement/application/MetaIngestion';
import { connectInstagramAccount, exchangeInstagramCode } from '../src/contexts/channel/application/ConnectInstagram';
import { decryptToken, encryptToken } from '../src/shared/infrastructure/crypto';

const [cmd, ...args] = process.argv.slice(2);
const tokenArg = (i: number) => args[i] || process.env.META_TOKEN || '';

function usage(): never {
  console.log(`Usage:
  bun scripts/meta-dev.ts pages      <user_token>
  bun scripts/meta-dev.ts connect    <workspace_slug> <user_token>
  bun scripts/meta-dev.ts connect-ig <workspace_slug> <ig_token>
  bun scripts/meta-dev.ts connect-ig-code <workspace_slug> <code>
  bun scripts/meta-dev.ts poll     <social_account_id>
  bun scripts/meta-dev.ts comments <social_account_id>`);
  process.exit(1);
}

async function longLived(token: string) {
  try {
    const res = await exchangeForLongLivedUserToken(token);
    const days = res.expires_in ? Math.round(res.expires_in / 86400) : '∞';
    console.log(`✓ Long-lived user token (expires in ~${days} days)`);
    return res.access_token;
  } catch (err) {
    console.warn(`! Exchange failed (${(err as Error).message}) — using token as-is`);
    return token;
  }
}

function printPages(pages: MetaPage[]) {
  if (pages.length === 0) {
    console.log('No Pages found. Check the token has pages_show_list and you have a role on the Page.');
    return;
  }
  for (const p of pages) {
    const ig = p.instagram_business_account;
    console.log(`• Page ${p.name} (${p.id})${ig ? `  ↔  IG @${ig.username} (${ig.id})` : '  — no IG Professional linked'}`);
  }
}

async function upsertAccount(
  workspaceId: string,
  platform: 'instagram' | 'facebook',
  externalId: string,
  username: string,
  avatarUrl: string | undefined,
  pageToken: string,
  opts: { scopes?: string[]; tokenExpiresAt?: Date | null } = {}
) {
  const values = {
    workspaceId,
    platform,
    externalId,
    username,
    avatarUrl,
    accessTokenEnc: encryptToken(pageToken),
    tokenExpiresAt: opts.tokenExpiresAt ?? null, // Page token from a long-lived user token does not expire
    scopes:
      opts.scopes ??
      (platform === 'instagram'
        ? ['instagram_basic', 'instagram_manage_comments', 'pages_read_engagement']
        : ['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement']),
    status: 'connected'
  };

  const [acc] = await db
    .insert(schema.socialAccounts)
    .values(values)
    .onConflictDoUpdate({ target: [schema.socialAccounts.platform, schema.socialAccounts.externalId], set: values })
    .returning();

  await db
    .insert(schema.replyPolicies)
    .values({
      socialAccountId: acc.id,
      mode: 'shadow', // PRD §10.1: start in Shadow — nothing is sent until you switch mode
      autoReplyIntents: ['praise', 'purchase_intent'],
      minConfidence: 0.8,
      brandVoice: { brandName: username, tone: 'Ramah dan profesional', useEmoji: true, cta: 'Silakan DM kami ya kak!', forbiddenPhrases: [] }
    })
    .onConflictDoNothing({ target: schema.replyPolicies.socialAccountId });

  console.log(`✓ ${platform.padEnd(9)} @${username} → social_account ${acc.id}`);
  return acc;
}

async function main() {
  switch (cmd) {
    case 'pages': {
      if (!tokenArg(0)) usage();
      printPages(await listPagesWithInstagram(await longLived(tokenArg(0))));
      break;
    }

    case 'connect': {
      const slug = args[0];
      const token = tokenArg(1);
      if (!slug || !token) usage();
      const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug) });
      if (!ws) throw new Error(`Workspace "${slug}" not found`);

      const pages = await listPagesWithInstagram(await longLived(token));
      printPages(pages);
      for (const p of pages) {
        await upsertAccount(ws.id, 'facebook', p.id, p.name, p.picture?.data?.url, p.access_token);
        const ig = p.instagram_business_account;
        if (ig) await upsertAccount(ws.id, 'instagram', ig.id, ig.username ?? ig.id, ig.profile_picture_url, p.access_token);
      }
      console.log('\nNext: run the worker (bun run dev:worker) or `poll <social_account_id>` to pull comments now.');
      break;
    }

    case 'connect-ig-code': {
      // ?code= from the Instagram redirect to META_IG_REDIRECT_URI (valid ~1h, single use)
      const slug = args[0];
      const code = args[1] || process.env.META_CODE || '';
      if (!slug || !code) usage();
      const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug) });
      if (!ws) throw new Error(`Workspace "${slug}" not found`);
      const { token, expiresAt } = await exchangeInstagramCode(code);
      const acc = await connectInstagramAccount(ws.id, token, expiresAt);
      console.log(`✓ instagram @${acc.username} → social_account ${acc.id}`);
      console.log('\nNext: `poll <social_account_id>` or run the worker.');
      break;
    }

    case 'connect-ig': {
      const slug = args[0];
      let token = tokenArg(1);
      if (!slug || !token) usage();
      const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug) });
      if (!ws) throw new Error(`Workspace "${slug}" not found`);

      // Dashboard tokens are already long-lived; 1h tokens need the exchange (requires META_IG_APP_SECRET).
      let expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);
      try {
        const res = await exchangeInstagramToken(token);
        token = res.access_token;
        expiresAt = new Date(Date.now() + res.expires_in * 1000);
      } catch {
        console.log('• Exchange skipped (token already long-lived or META_IG_APP_SECRET missing)');
      }
      const acc = await connectInstagramAccount(ws.id, token, expiresAt);
      console.log(`✓ instagram @${acc.username} → social_account ${acc.id}`);
      break;
    }

    case 'poll': {
      if (!args[0]) usage();
      console.log(await pollAccount(args[0]));
      break;
    }

    case 'comments': {
      if (!args[0]) usage();
      const acc = await db.query.socialAccounts.findFirst({ where: eq(schema.socialAccounts.id, args[0]) });
      if (!acc || !isMetaPlatform(acc.platform)) throw new Error('Meta social account not found');
      const token = decryptToken(acc.accessTokenEnc);
      const api = metaApiFor(acc);
      for (const post of await MetaGraph.listPosts(acc.platform, acc.externalId, token, 5, api)) {
        console.log(`\n■ ${post.externalId}  ${post.caption?.slice(0, 60) ?? ''}\n  ${post.permalink ?? ''}`);
        for (const c of await MetaGraph.listComments(acc.platform, post.externalId, token, api)) {
          console.log(`  - [${c.externalId}] ${c.authorName ?? '?'}: ${c.text}`);
        }
      }
      break;
    }

    default:
      usage();
  }
}

main()
  .catch((err) => {
    console.error('✗', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
