// App-wide client session (demo auth in localStorage) shared by /login and the (app) layout.

import { api } from './api';
import type { UserRole } from './types';

const KEYS = {
  auth: 'replyra_auth',
  role: 'replyra_role',
  user: 'replyra_user',
  session: 'replyra_session',
  theme: 'replyra_theme'
} as const;

export type SessionUser = { id?: string; name?: string; email?: string; avatarUrl?: string } | null;

export const session = $state({
  ready: false,
  isAuthenticated: false,
  role: 'owner' as UserRole,
  user: null as SessionUser,
  workspace: 'maujahit',
  isDarkMode: false,
  isLangEn: false,
  pendingReviewCount: 0
});

/** Read persisted auth + theme. Call once on the client before rendering guarded pages. */
export function restoreSession() {
  if (session.ready || typeof window === 'undefined') return;

  session.isAuthenticated = localStorage.getItem(KEYS.auth) === 'true';
  const role = localStorage.getItem(KEYS.role) as UserRole | null;
  if (role) session.role = role;
  try {
    session.user = JSON.parse(localStorage.getItem(KEYS.user) ?? 'null');
  } catch {
    session.user = null;
  }

  const theme = localStorage.getItem(KEYS.theme);
  applyTheme(theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  session.ready = true;
}

export function signIn(role: UserRole, user?: SessionUser) {
  session.isAuthenticated = true;
  session.role = role;
  session.user = user ?? null;
  localStorage.setItem(KEYS.auth, 'true');
  localStorage.setItem(KEYS.role, role);
  if (user) localStorage.setItem(KEYS.user, JSON.stringify(user));
}

export function signOut() {
  session.isAuthenticated = false;
  session.user = null;
  for (const k of [KEYS.auth, KEYS.role, KEYS.user, KEYS.session]) localStorage.removeItem(k);
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
  try {
    session.pendingReviewCount = (await api.getReviewQueue(session.workspace)).length;
  } catch {
    // keep last known count
  }
}
