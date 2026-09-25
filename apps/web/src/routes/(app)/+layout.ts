import { redirect } from '@sveltejs/kit';
import { session } from '$lib/session.svelte';
import { LOGIN_PATH } from '$lib/nav';

export const load = ({ url }) => {
  if (!session.isAuthenticated) {
    redirect(307, `${LOGIN_PATH}?redirect=${encodeURIComponent(url.pathname + url.search)}`);
  }
};
