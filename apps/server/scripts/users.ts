#!/usr/bin/env bun
// Account provisioning from the server shell (also bundled as dist/users.cjs).
//
//   USER_PASSWORD='…' bun scripts/users.ts create <email> "<name>" <workspace_slug> <owner|admin|viewer>
//   USER_PASSWORD='…' bun scripts/users.ts superadmin <email> ["<name>"]   (platform operator, /admin)
//   USER_PASSWORD='…' bun scripts/users.ts set-password <email>
//   bun scripts/users.ts workspace <slug> "<name>" [plan_id]                (default: growth, 1 month active)
//   bun scripts/users.ts list
//
// Omit USER_PASSWORD to generate a strong random password (printed once).

import crypto from 'node:crypto';
import { db, schema, client } from '@replyra/db';
import { eq } from 'drizzle-orm';
import {
  MIN_PASSWORD,
  addMembership,
  createUser,
  findUserByEmail,
  setPassword,
  type Role
} from '../src/contexts/identity/application/Accounts';

const [cmd, ...args] = process.argv.slice(2);
const ROLES: Role[] = ['owner', 'admin', 'viewer'];

function usage(): never {
  console.log(`Usage:
  USER_PASSWORD='…' bun scripts/users.ts create <email> "<name>" <workspace_slug> <owner|admin|viewer>
  USER_PASSWORD='…' bun scripts/users.ts superadmin <email> ["<name>"]
  USER_PASSWORD='…' bun scripts/users.ts set-password <email>
  bun scripts/users.ts workspace <slug> "<name>" [plan_id]
  bun scripts/users.ts list`);
  process.exit(1);
}

function password(): { value: string; generated: boolean } {
  const env = process.env.USER_PASSWORD;
  if (env) {
    if (env.length < MIN_PASSWORD) throw new Error(`USER_PASSWORD must be at least ${MIN_PASSWORD} characters`);
    return { value: env, generated: false };
  }
  return { value: crypto.randomBytes(12).toString('base64url'), generated: true };
}

const showPassword = (p: { value: string; generated: boolean }) => {
  if (p.generated) console.log(`  password: ${p.value}   ← shown once, store it now`);
};

async function main() {
  switch (cmd) {
    case 'create': {
      const [email, name, slug, role] = args;
      if (!email || !name || !slug || !ROLES.includes(role as Role)) usage();
      const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug) });
      if (!ws) throw new Error(`Workspace "${slug}" not found`);
      const user = (await findUserByEmail(email)) ?? (await createUser({ email, name, emailVerified: true }));
      const pw = password();
      await setPassword(user.id, pw.value);
      await addMembership(ws.id, user.id, role as Role);
      console.log(`✓ ${user.email} → ${slug} (${role})`);
      showPassword(pw);
      break;
    }

    case 'superadmin': {
      const [email, name] = args;
      if (!email) usage();
      let user = await findUserByEmail(email);
      const pw = password();
      if (!user) {
        user = await createUser({ email, name: name || 'Superadmin', emailVerified: true });
        await setPassword(user.id, pw.value);
        showPassword(pw);
      } else if (process.env.USER_PASSWORD) {
        await setPassword(user.id, pw.value);
      }
      await db.update(schema.users).set({ isSuperadmin: true }).where(eq(schema.users.id, user.id));
      console.log(`✓ ${user.email} is a superadmin`);
      break;
    }

    case 'set-password': {
      const [email] = args;
      if (!email) usage();
      const user = await findUserByEmail(email);
      if (!user) throw new Error(`User ${email} not found`);
      const pw = password();
      await setPassword(user.id, pw.value);
      console.log(`✓ password updated for ${user.email} (all sessions signed out)`);
      showPassword(pw);
      break;
    }

    case 'workspace': {
      const [slug, name, planId = 'growth'] = args;
      if (!slug || !name || !/^[a-z0-9-]+$/.test(slug)) usage();
      const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, planId) });
      if (!plan) throw new Error(`Plan "${planId}" not found`);
      const [ws] = await db.insert(schema.workspaces).values({ slug, name }).onConflictDoNothing().returning();
      if (!ws) {
        console.log(`• workspace "${slug}" already exists`);
        break;
      }
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.insert(schema.subscriptions).values({
        workspaceId: ws.id,
        planId,
        periodStart: new Date(),
        periodEnd,
        status: planId === 'trial' ? 'trial' : 'active'
      });
      console.log(`✓ workspace ${slug} (${name}) — ${plan.name}`);
      break;
    }

    case 'list': {
      const rows = await db
        .select({
          email: schema.users.email,
          name: schema.users.name,
          superadmin: schema.users.isSuperadmin,
          ws: schema.workspaces.slug,
          role: schema.memberships.role
        })
        .from(schema.users)
        .leftJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
        .leftJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId));
      for (const r of rows) {
        console.log(`${r.email.padEnd(32)} ${r.name.padEnd(24)} ${r.superadmin ? '[superadmin] ' : ''}${r.ws ?? '-'} ${r.role ?? ''}`);
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
