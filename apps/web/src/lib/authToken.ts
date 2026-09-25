// Bearer session token from Better Auth (`set-auth-token`). Kept dependency-free so api.ts and
// session.svelte.ts can both use it without an import cycle.

const KEY = 'replyra_token';

export const getToken = () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY));
export const setToken = (token: string) => localStorage.setItem(KEY, token);
export const clearToken = () => localStorage.removeItem(KEY);

let onUnauthorized: (() => void) | null = null;
/** Registered by the app shell: called once when the API rejects the session (401). */
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

/** fetch() + Authorization header; a 401 from our API ends the local session. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && token) onUnauthorized?.();
  return res;
}
