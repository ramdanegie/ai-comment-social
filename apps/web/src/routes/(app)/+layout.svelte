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
  import { session, signOut, refreshReviewCount } from '$lib/session.svelte';

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

  onMount(refreshReviewCount);

  // Close the mobile drawer and refresh the queue badge on every navigation.
  afterNavigate(() => {
    isMobileMenuOpen = false;
    refreshReviewCount();
  });

  const navigate = (id: string) => goto(pathFor(id));

  function handleLogoutSuccess() {
    isLogoutModalOpen = false;
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

<div class="flex min-h-screen flex-col bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100">
  <Navbar
    bind:activeWorkspace={session.workspace}
    bind:currentRole={session.role}
    bind:isDarkMode={session.isDarkMode}
    bind:isLangEn={session.isLangEn}
    pendingReviewCount={session.pendingReviewCount}
    onToggleMobileMenu={() => (isMobileMenuOpen = !isMobileMenuOpen)}
    onOpenOnboarding={() => (isOnboardingOpen = true)}
    onSelectPage={navigate}
    onLogout={() => (isLogoutModalOpen = true)}
  />

  <div class="flex flex-1">
    <Sidebar
      {activePage}
      pendingReviewCount={session.pendingReviewCount}
      isLangEn={session.isLangEn}
      currentRole={session.role}
      currentUser={session.user}
      onLogout={() => (isLogoutModalOpen = true)}
    />

    <main class="flex-1 overflow-x-hidden p-4 pb-24 sm:p-6 sm:pb-28 lg:p-8 lg:pb-12">
      <div class="mx-auto max-w-7xl">
        {@render children()}
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
    <div class="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs lg:hidden">
      <div class="flex w-72 flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
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
        class="flex-1 cursor-default border-none bg-transparent"
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
