#!/usr/bin/env bun
// Provision login accounts (Better Auth credential accounts) — self sign-up is disabled.
//
//   USER_PASSWORD='…' bun scripts/users.ts create <email> "<name>" <workspace_slug> <owner|admin|viewer>
//   USER_PASSWORD='…' bun scripts/users.ts set-password <email>
//   bun scripts/users.ts workspace <slug> "<name>"        (create a workspace, Growth plan)
//   bun scripts/users.ts list
//
// Omit USER_PASSWORD to generate a strong random password (printed once).

import crypto from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { db, schema, client } from '@replyra/db';
import { and, eq } from 'drizzle-orm';

const [cmd, ...args] = process.argv.slice(2);
const ROLES = ['owner', 'admin', 'viewer'] as const;

function usage(): never {
  console.log(`Usage:
  USER_PASSWORD='…' bun scripts/users.ts create <email> "<name>" <workspace_slug> <owner|admin|viewer>
  USER_PASSWORD='…' bun scripts/users.ts set-password <email>
  bun scripts/users.ts workspace <slug> "<name>"
  bun scripts/users.ts list`);
  process.exit(1);
}

function passwordFromEnv(): { password: string; generated: boolean } {
  const fromEnv = process.env.USER_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < 10) throw new Error('USER_PASSWORD must be at least 10 characters');
    return { password: fromEnv, generated: false };
  }
  return { password: crypto.randomBytes(12).toString('base64url'), generated: true };
}

/** Create or replace the credential (email/password) account for a user. */
async function setCredential(userId: string, password: string) {
  const hash = await hashPassword(password);
  const existing = await db.query.accounts.findFirst({
    where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.providerId, 'credential'))
  });
  if (existing) {
    await db.update(schema.accounts).set({ password: hash, updatedAt: new Date() }).where(eq(schema.accounts.id, existing.id));
  } else {
    await db.insert(schema.accounts).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hash,
      updatedAt: new Date()
    });
  }
  // Force re-login everywhere after a password change.
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

async function main() {
  switch (cmd) {
    case 'create': {
      const [rawEmail, name, slug, role] = args;
      if (!rawEmail || !name || !slug || !ROLES.includes(role as (typeof ROLES)[number])) usage();
      const email = rawEmail.trim().toLowerCase();

      const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug) });
      if (!ws) throw new Error(`Workspace "${slug}" not found`);

      let user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (!user) {
        [user] = await db
          .insert(schema.users)
          .values({ id: crypto.randomUUID(), email, name, emailVerified: true })
          .returning();
      }

      const { password, generated } = passwordFromEnv();
      await setCredential(user.id, password);
      await db
        .insert(schema.memberships)
        .values({ workspaceId: ws.id, userId: user.id, role: role as (typeof ROLES)[number] })
        .onConflictDoUpdate({ target: [schema.memberships.workspaceId, schema.memberships.userId], set: { role: role as (typeof ROLES)[number] } });

      console.log(`✓ ${email} → ${slug} (${role})`);
      if (generated) console.log(`  password: ${password}   ← shown once, store it now`);
      break;
    }

    case 'set-password': {
      const email = args[0]?.trim().toLowerCase();
      if (!email) usage();
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (!user) throw new Error(`User ${email} not found`);
      const { password, generated } = passwordFromEnv();
      await setCredential(user.id, password);
      console.log(`✓ password updated for ${email} (all sessions signed out)`);
      if (generated) console.log(`  password: ${password}   ← shown once, store it now`);
      break;
    }

    case 'workspace': {
      const [slug, name] = args;
      if (!slug || !name || !/^[a-z0-9-]+$/.test(slug)) usage();
      const [ws] = await db.insert(schema.workspaces).values({ slug, name }).onConflictDoNothing().returning();
      if (!ws) {
        console.log(`• workspace "${slug}" already exists`);
        break;
      }
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.insert(schema.subscriptions).values({
        workspaceId: ws.id,
        planId: 'growth',
        periodStart: new Date(),
        periodEnd,
        status: 'active'
      });
      console.log(`✓ workspace ${slug} (${name}) — Growth plan`);
      break;
    }

    case 'list': {
      const rows = await db
        .select({ email: schema.users.email, name: schema.users.name, ws: schema.workspaces.slug, role: schema.memberships.role })
        .from(schema.users)
        .leftJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
        .leftJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId));
      for (const r of rows) console.log(`${r.email.padEnd(32)} ${r.name.padEnd(24)} ${r.ws ?? '-'} ${r.role ?? ''}`);
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
