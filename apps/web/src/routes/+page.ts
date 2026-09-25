import { redirect } from '@sveltejs/kit';
import { session } from '$lib/session.svelte';
import { HOME_PATH, LOGIN_PATH } from '$lib/nav';

const INSTAGRAM_CALLBACK_PATH = '/accounts/instagram/callback';

export const load = ({ url }) => {
  // Instagram Login may redirect to the site root (META_IG_REDIRECT_URI) — hand it to the callback page.
  if (url.searchParams.has('code') || url.searchParams.has('error_reason')) {
    redirect(307, INSTAGRAM_CALLBACK_PATH + url.search);
  }
  redirect(307, session.isAuthenticated ? HOME_PATH : LOGIN_PATH);
};
