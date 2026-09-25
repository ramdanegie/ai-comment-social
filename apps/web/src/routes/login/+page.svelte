<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import LoginView from '$lib/components/LoginView.svelte';
  import { toast } from '$lib/toast';
  import { HOME_PATH } from '$lib/nav';
  import { session, signIn, signOut, toggleTheme, toggleLang, type SessionUser } from '$lib/session.svelte';
  import type { UserRole } from '$lib/types';

  /** Only allow same-app paths as post-login targets (no open redirect). */
  function target() {
    const r = page.url.searchParams.get('redirect');
    return r && r.startsWith('/') && !r.startsWith('//') ? r : HOME_PATH;
  }

  onMount(() => {
    if (page.url.searchParams.get('action') === 'logout') signOut();
    else if (session.isAuthenticated) goto(target(), { replaceState: true });
  });

  function handleLogin(role: UserRole = 'owner', user?: SessionUser) {
    signIn(role, user);
    toast.success(
      session.isLangEn ? `Signed in as ${user?.name || role} (${role})` : `Berhasil masuk sebagai ${user?.name || role} (${role})`,
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
