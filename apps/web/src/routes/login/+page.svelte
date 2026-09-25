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
    goto(target(), { replaceState: true });
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
