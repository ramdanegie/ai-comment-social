import { restoreSession } from '$lib/session.svelte';

// Dashboard lives behind login (PRD §2: SPA, no SSR needed). Session is in localStorage → client only.
export const ssr = false;

export const load = () => {
  restoreSession();
};
