// App-wide client session (Better Auth bearer token + memberships) shared by /login and the (app) layout.

import { api, type Me } from './api';
import { clearToken, getToken } from './authToken';
import type { UserRole } from './types';

const KEYS = {
  auth: 'replyra_auth',
  role: 'replyra_role',
  user: 'replyra_user',
  session: 'replyra_session',
  theme: 'replyra_theme',
  workspace: 'replyra_workspace'
} as const;

export type SessionUser = { id?: string; name?: string; email?: string; avatarUrl?: string; isSuperadmin?: boolean } | null;

export type WorkspaceMembership = Me['workspaces'][number];

export const session = $state({
  ready: false,
  isAuthenticated: false,
  /** Role in the *current* workspace — enforced by the API, mirrored here for UI only. */
  role: 'viewer' as UserRole,
  user: null as SessionUser,
  workspaces: [] as WorkspaceMembership[],
  workspace: '',
  isDarkMode: false,
  isLangEn: false,
  pendingReviewCount: 0
});

/** Read persisted session + theme. Call once on the client before rendering guarded pages. */
export function restoreSession() {
  if (session.ready || typeof window === 'undefined') return;

  const token = getToken();
  let me: Me | null = null;
  try {
    me = JSON.parse(localStorage.getItem(KEYS.user) ?? 'null');
  } catch {
    me = null;
  }
  // Optimistic: the (app) layout re-validates with /api/v1/me and signs out on 401.
  if (token && me?.user) applyMe(me, localStorage.getItem(KEYS.workspace));

  const theme = localStorage.getItem(KEYS.theme);
  applyTheme(theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  session.ready = true;
}

function applyMe(me: Me, preferredWorkspace?: string | null) {
  session.isAuthenticated = true;
  session.user = me.user;
  session.workspaces = me.workspaces;
  const current =
    me.workspaces.find((w) => w.slug === (preferredWorkspace ?? session.workspace)) ?? me.workspaces[0];
  session.workspace = current?.slug ?? '';
  session.role = current?.role ?? 'viewer';
}

/** Called after a successful sign-in (token already stored by api.signIn). */
export function signIn(me: Me) {
  localStorage.setItem(KEYS.user, JSON.stringify(me));
  applyMe(me, localStorage.getItem(KEYS.workspace));
}

/** Re-fetch /me (roles or memberships may have changed server-side). */
export async function refreshMe() {
  const me = await api.getMe();
  signIn(me);
}

export function selectWorkspace(slug: string) {
  const ws = session.workspaces.find((w) => w.slug === slug);
  if (!ws) return;
  session.workspace = ws.slug;
  session.role = ws.role;
  localStorage.setItem(KEYS.workspace, ws.slug);
}

/** Local sign-out; call api.signOut() first when the server session should be revoked too. */
export function signOut() {
  session.isAuthenticated = false;
  session.user = null;
  session.workspaces = [];
  session.workspace = '';
  session.role = 'viewer';
  clearToken();
  for (const k of [KEYS.auth, KEYS.role, KEYS.user, KEYS.session, KEYS.workspace]) localStorage.removeItem(k);
}

function applyTheme(dark: boolean) {
  session.isDarkMode = dark;
  document.documentElement.classList.toggle('dark', dark);
}

export function toggleTheme() {
  applyTheme(!session.isDarkMode);
  localStorage.setItem(KEYS.theme, session.isDarkMode ? 'dark' : 'light');
}

export function toggleLang() {
  session.isLangEn = !session.isLangEn;
}

export async function refreshReviewCount() {
  if (!session.workspace) return; // e.g. superadmin without a workspace
  try {
    session.pendingReviewCount = (await api.getReviewQueue(session.workspace)).length;
  } catch {
    // keep last known count
  }
}
