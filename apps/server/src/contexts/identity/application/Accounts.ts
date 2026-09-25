// User / workspace provisioning shared by public sign-up (/api/v1/auth/register) and scripts/users.ts.
// Credentials are Better Auth "credential" accounts (hashed with Better Auth's own hasher).

import crypto from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { db, schema } from '@replyra/db';
import { and, eq } from 'drizzle-orm';
import { startTrial } from '../../billing/application/Billing';

export const MIN_PASSWORD = 10;
export type Role = 'owner' | 'admin' | 'viewer';

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(schema.users.email, normalizeEmail(email)) });
}

export async function createUser(args: { email: string; name: string; emailVerified?: boolean }) {
  const [user] = await db
    .insert(schema.users)
    .values({ id: crypto.randomUUID(), email: normalizeEmail(args.email), name: args.name.trim(), emailVerified: args.emailVerified ?? false })
    .returning();
  return user;
}

/** Create or replace the email/password credential; signs the user out everywhere. */
export async function setPassword(userId: string, password: string) {
  if (password.length < MIN_PASSWORD) throw new Error(`Kata sandi minimal ${MIN_PASSWORD} karakter`);
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
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export async function addMembership(workspaceId: string, userId: string, role: Role) {
  await db
    .insert(schema.memberships)
    .values({ workspaceId, userId, role })
    .onConflictDoUpdate({ target: [schema.memberships.workspaceId, schema.memberships.userId], set: { role } });
}

/** URL-safe slug that doesn't collide with an existing workspace. */
export async function uniqueWorkspaceSlug(name: string) {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace';
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${crypto.randomBytes(2).toString('hex')}`;
    const taken = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug) });
    if (!taken) return slug;
  }
  throw new Error('Tidak bisa membuat slug workspace unik');
}

/** Public SaaS sign-up: user + owner membership + new workspace on a trial subscription. */
export async function registerTenant(args: { name: string; email: string; password: string; brandName: string }) {
  if (await findUserByEmail(args.email)) throw new RegistrationError('Email sudah terdaftar. Silakan masuk.');
  if (args.password.length < MIN_PASSWORD) throw new RegistrationError(`Kata sandi minimal ${MIN_PASSWORD} karakter`);

  const user = await createUser({ email: args.email, name: args.name });
  await setPassword(user.id, args.password);

  const [workspace] = await db
    .insert(schema.workspaces)
    .values({ name: args.brandName.trim(), slug: await uniqueWorkspaceSlug(args.brandName) })
    .returning();
  await addMembership(workspace.id, user.id, 'owner');
  await startTrial(workspace.id);

  await db.insert(schema.auditLogs).values({
    workspaceId: workspace.id,
    actor: user.id,
    action: 'auth.registered',
    targetType: 'workspace',
    targetId: workspace.id,
    meta: { email: user.email }
  });
  return { user, workspace };
}

/** Social sign-up: a user with no workspace yet gets their own (owner, trial). */
export async function ensureTenantWorkspace(user: { id: string; name: string; email: string }) {
  const existing = await db.query.memberships.findFirst({ where: eq(schema.memberships.userId, user.id) });
  if (existing) return null;
  const brand = user.name?.trim() || user.email.split('@')[0];
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({ name: brand, slug: await uniqueWorkspaceSlug(brand) })
    .returning();
  await addMembership(workspace.id, user.id, 'owner');
  await startTrial(workspace.id);
  await db.insert(schema.auditLogs).values({
    workspaceId: workspace.id,
    actor: user.id,
    action: 'auth.registered',
    targetType: 'workspace',
    targetId: workspace.id,
    meta: { email: user.email, via: 'google' }
  });
  return workspace;
}

export class RegistrationError extends Error {}
