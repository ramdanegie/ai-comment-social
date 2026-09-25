// Central authentication + tenant/role authorization for every HTTP route (PRD §8, §18.1-3, AC-5).
// Routes stay declarative in server.ts; access rules live here in one table.

import { Elysia } from 'elysia';
import { db, schema } from '@replyra/db';
import { and, eq } from 'drizzle-orm';
import { auth } from '../infrastructure/auth';

export type Role = 'viewer' | 'admin' | 'owner';
const RANK: Record<Role, number> = { viewer: 0, admin: 1, owner: 2 };

/** Reachable without a session. */
const PUBLIC = [
  /^\/health$/,
  /^\/swagger(\/|$)/,
  /^\/api\/auth\//,
  /^\/webhooks\//,
  /^\/api\/v1\/plans$/,
  /^\/api\/v1\/pricing$/,
  /^\/api\/v1\/register$/,
  /^\/api\/v1\/auth\/social-done$/
];

/** Minimum role per workspace route; first match wins. Default: GET → viewer, writes → admin. */
const RULES: Array<{ method: string; path: RegExp; role: Role }> = [
  { method: 'GET', path: /\/audit-logs$/, role: 'owner' },
  { method: 'GET', path: /\/billing$/, role: 'owner' },
  { method: 'POST', path: /\/billing\/checkout$/, role: 'owner' },
  { method: 'DELETE', path: /\/accounts\/[^/]+$/, role: 'owner' },
  { method: 'GET', path: /\/members$/, role: 'admin' },
  { method: 'GET', path: /\/accounts\/connect\//, role: 'admin' }
];

const WS_PATH = /^\/api\/v1\/workspaces\/([^/]+)(\/.*)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requiredRole(method: string, rest: string): Role {
  const rule = RULES.find((r) => r.method === method && r.path.test(rest));
  if (rule) return rule.role;
  return method === 'GET' ? 'viewer' : 'admin';
}

async function findWorkspace(identifier: string) {
  const bySlug = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, identifier) });
  if (bySlug || !UUID.test(identifier)) return bySlug;
  return db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, identifier) });
}

export const authGuard = new Elysia({ name: 'auth-guard' })
  .derive({ as: 'global' }, async ({ request, path }) => {
    const session = await auth.api.getSession({ headers: request.headers });

    const m = path.match(WS_PATH);
    if (!session || !m) return { session, workspace: null, membership: null };

    const workspace = await findWorkspace(decodeURIComponent(m[1]));
    const membership = workspace
      ? await db.query.memberships.findFirst({
          where: and(eq(schema.memberships.workspaceId, workspace.id), eq(schema.memberships.userId, session.user.id))
        })
      : null;
    return { session, workspace, membership };
  })
  .onBeforeHandle({ as: 'global' }, ({ request, path, session, workspace, membership, set }) => {
    if (request.method === 'OPTIONS' || PUBLIC.some((re) => re.test(path))) return;

    if (!session) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    // Platform administration (prices, all workspaces, all payments).
    if (path.startsWith('/api/v1/admin/') || path === '/api/v1/admin') {
      if (!(session.user as { isSuperadmin?: boolean }).isSuperadmin) {
        set.status = 403;
        return { error: 'Superadmin only' };
      }
      return;
    }

    const m = path.match(WS_PATH);
    if (!m) return; // e.g. /api/v1/me, /api/v1/workspaces (list/create) — any signed-in user

    // Same 404 for "doesn't exist" and "not a member" so workspace slugs can't be probed.
    if (!workspace || !membership) {
      set.status = 404;
      return { error: 'Workspace not found' };
    }

    const needed = requiredRole(request.method, m[2] ?? '');
    if (RANK[membership.role as Role] < RANK[needed]) {
      set.status = 403;
      return { error: `Requires ${needed} role` };
    }
  });
