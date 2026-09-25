<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import {
    LayoutDashboard,
    AlertCircle,
    MessageSquare,
    Share2,
    Sliders,
    BarChart3,
    CreditCard,
    Settings,
    X,
    MessageSquareQuote,
    LogOut
  } from 'lucide-svelte';
  import Navbar from '$lib/components/Navbar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import OnboardingModal from '$lib/components/OnboardingModal.svelte';
  import LogoutModal from '$lib/components/LogoutModal.svelte';
  import { toast } from '$lib/toast';
  import { PAGES, LOGIN_PATH, pageIdFromPath, pathFor, type PageId } from '$lib/nav';
  import { api } from '$lib/api';
  import { setUnauthorizedHandler } from '$lib/authToken';
  import { session, signOut, refreshMe, refreshReviewCount, selectWorkspace } from '$lib/session.svelte';

  let { children } = $props();

  let isMobileMenuOpen = $state(false);
  let isOnboardingOpen = $state(false);
  let isLogoutModalOpen = $state(false);

  let activePage = $derived(pageIdFromPath(page.url.pathname) ?? 'dashboard');

  const drawerIcons: Record<PageId, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    review: AlertCircle,
    comments: MessageSquare,
    accounts: Share2,
    policies: Sliders,
    reports: BarChart3,
    billing: CreditCard,
    settings: Settings
  };

  onMount(() => {
    // Session expired or revoked server-side → back to login, then return here.
    setUnauthorizedHandler(() => {
      signOut();
      goto(`${LOGIN_PATH}?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`, { replaceState: true });
    });
    // Re-validate the stored session and pick up role/membership changes.
    refreshMe().catch(() => {});
    refreshReviewCount();
  });

  // Workspace switcher (Navbar) → keep role + persisted choice in sync.
  $effect(() => {
    if (session.workspace) selectWorkspace(session.workspace);
  });

  // Close the mobile drawer and refresh the queue badge on every navigation.
  afterNavigate(() => {
    isMobileMenuOpen = false;
    refreshReviewCount();
  });

  function menuFocus(node: HTMLElement) {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') isMobileMenuOpen = false;
      if (event.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select'));
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) {
        event.preventDefault(); first?.focus();
      }
    }
    node.addEventListener('keydown', onKey);
    return { destroy() {
      document.body.style.overflow = previousOverflow;
      node.removeEventListener('keydown', onKey);
      previous?.focus();
    } };
  }

  const navigate = (id: string) => goto(pathFor(id));

  async function handleLogoutSuccess() {
    isLogoutModalOpen = false;
    await api.signOut(); // revoke the server session, not just the local token
    signOut();
    toast.info(
      session.isLangEn ? 'Signed out of Replyra.' : 'Berhasil keluar dari akun Replyra.',
      session.isLangEn ? 'Signed out' : 'Keluar akun'
    );
    goto(LOGIN_PATH, { replaceState: true });
  }
</script>

<svelte:head>
  <title>{PAGES[activePage][session.isLangEn ? 'labelEn' : 'labelId']} · Replyra</title>
</svelte:head>

<div class="app-shell flex min-h-dvh flex-col text-slate-800 dark:text-slate-100">
  <a href="#main-content" class="skip-link">{session.isLangEn ? 'Skip to content' : 'Langsung ke konten'}</a>
  <Navbar
    bind:activeWorkspace={session.workspace}
    currentRole={session.role}
    bind:isDarkMode={session.isDarkMode}
    bind:isLangEn={session.isLangEn}
    pendingReviewCount={session.pendingReviewCount}
    onToggleMobileMenu={() => (isMobileMenuOpen = !isMobileMenuOpen)}
    onOpenOnboarding={() => (isOnboardingOpen = true)}
    onSelectPage={navigate}
    onLogout={() => (isLogoutModalOpen = true)}
  />

  <div class="flex flex-1 items-start">
    <Sidebar
      {activePage}
      pendingReviewCount={session.pendingReviewCount}
      isLangEn={session.isLangEn}
      currentRole={session.role}
      currentUser={session.user}
      workspaceName={session.workspaces.find((w) => w.slug === session.workspace)?.name ?? ''}
      onLogout={() => (isLogoutModalOpen = true)}
    />

    <main id="main-content" tabindex="-1" class="app-content min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <div class="mx-auto max-w-7xl">
        {#if session.workspace}
          {@render children()}
        {:else if session.isAuthenticated}
          <div class="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
            {session.isLangEn
              ? 'Your account is not a member of any workspace yet. Ask the workspace owner to invite you.'
              : 'Akun Anda belum tergabung di workspace mana pun. Minta owner workspace untuk mengundang Anda.'}
          </div>
        {/if}
      </div>
    </main>
  </div>

  <BottomNav
    {activePage}
    pendingReviewCount={session.pendingReviewCount}
    isLangEn={session.isLangEn}
    onOpenMoreMenu={() => (isMobileMenuOpen = true)}
  />

  <!-- Mobile drawer -->
  {#if isMobileMenuOpen}
    <div class="mobile-menu-overlay fixed inset-0 z-50 flex lg:hidden">
      <div use:menuFocus role="dialog" aria-modal="true" aria-label={session.isLangEn ? 'Navigation' : 'Navigasi'} tabindex="-1" class="mobile-menu-sheet glass-panel flex flex-col justify-between p-5">
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div class="flex items-center gap-2.5">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <MessageSquareQuote class="h-4 w-4" />
              </div>
              <span class="font-bold text-slate-900 dark:text-white">Menu</span>
            </div>
            <button
              type="button"
              class="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label={session.isLangEn ? 'Close menu' : 'Tutup menu'}
              onclick={() => (isMobileMenuOpen = false)}
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <nav class="space-y-1 text-sm font-medium">
            {#each Object.entries(PAGES) as [id, p] (id)}
              {@const Icon = drawerIcons[id as PageId]}
              {@const isActive = activePage === id}
              <a
                href={p.path}
                aria-current={isActive ? 'page' : undefined}
                class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition {isActive
                  ? 'bg-brand-500/10 font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
              >
                <span class="flex items-center gap-3">
                  <Icon class="h-4.5 w-4.5" />
                  {session.isLangEn ? p.labelEn : p.labelId}
                </span>
                {#if id === 'review' && session.pendingReviewCount > 0}
                  <span class="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-400">
                    {session.pendingReviewCount}
                  </span>
                {/if}
              </a>
            {/each}
          </nav>
        </div>

        <div class="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            class="w-full rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-700"
            onclick={() => {
              isMobileMenuOpen = false;
              isOnboardingOpen = true;
            }}
          >
            {session.isLangEn ? 'Set up new brand' : 'Setup Brand Baru'}
          </button>
          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-500"
            onclick={() => {
              isMobileMenuOpen = false;
              isLogoutModalOpen = true;
            }}
          >
            <LogOut class="h-4 w-4" />
            {session.isLangEn ? 'Log out' : 'Keluar Akun'}
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label={session.isLangEn ? 'Close menu' : 'Tutup menu'}
        class="menu-backdrop absolute inset-0 -z-10 cursor-default border-none bg-transparent"
        onclick={() => (isMobileMenuOpen = false)}
      ></button>
    </div>
  {/if}

  <OnboardingModal bind:isOpen={isOnboardingOpen} onClose={() => (isOnboardingOpen = false)} isLangEn={session.isLangEn} />

  <LogoutModal
    bind:isOpen={isLogoutModalOpen}
    isLangEn={session.isLangEn}
    currentUser={session.user}
    currentRole={session.role}
    onSuccess={handleLogoutSuccess}
  />
</div>
