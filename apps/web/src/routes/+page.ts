import { redirect } from '@sveltejs/kit';
import { session } from '$lib/session.svelte';
import { HOME_PATH, LOGIN_PATH } from '$lib/nav';

export const load = () => {
  redirect(307, session.isAuthenticated ? HOME_PATH : LOGIN_PATH);
};
