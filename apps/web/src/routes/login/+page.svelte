<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import LoginView from '$lib/components/LoginView.svelte';
  import { toast } from '$lib/toast';
  import { HOME_PATH } from '$lib/nav';
  import { api, type Me } from '$lib/api';
  import { session, signIn, signOut, toggleTheme, toggleLang } from '$lib/session.svelte';

  /** Only allow same-app paths as post-login targets (no open redirect). */
  function target() {
    const r = page.url.searchParams.get('redirect');
    return r && r.startsWith('/') && !r.startsWith('//') ? r : HOME_PATH;
  }

  onMount(async () => {
    // Return from Google sign-in: /login#token=… (fragment is never sent to a server)
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (token) {
      history.replaceState(null, '', window.location.pathname);
      try {
        return handleLogin(await api.signInWithToken(token));
      } catch {
        toast.error('Login Google gagal. Coba lagi.');
      }
    }
    if (page.url.searchParams.get('error') === 'google') {
      toast.error(session.isLangEn ? 'Google sign-in failed.' : 'Login Google gagal. Coba lagi.');
    }
    if (page.url.searchParams.get('action') === 'logout') {
      await api.signOut();
      signOut();
    } else if (session.isAuthenticated) {
      goto(target(), { replaceState: true });
    }
  });

  function handleLogin(me: Me) {
    signIn(me);
    toast.success(
      session.isLangEn ? `Signed in as ${me.user.name}` : `Berhasil masuk sebagai ${me.user.name}`,
      session.isLangEn ? 'Welcome back' : 'Selamat datang'
    );
    const dest = me.user.isSuperadmin && me.workspaces.length === 0 ? '/admin' : target();
    goto(dest, { replaceState: true });
  }
</script>

<svelte:head><title>Login · Replyra</title></svelte:head>

<LoginView
  isLangEn={session.isLangEn}
  isDarkMode={session.isDarkMode}
  onLogin={handleLogin}
  onToggleTheme={toggleTheme}
  onToggleLang={toggleLang}
/>
