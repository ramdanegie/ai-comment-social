<script lang="ts">
  import { onMount } from 'svelte';
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
  import { api } from '../lib/api';
  import type { UserRole } from '../lib/types';
  import Navbar from '../lib/components/Navbar.svelte';
  import Sidebar from '../lib/components/Sidebar.svelte';
  import BottomNav from '../lib/components/BottomNav.svelte';
  import DashboardView from '../lib/components/DashboardView.svelte';
  import ReviewQueueView from '../lib/components/ReviewQueueView.svelte';
  import CommentsView from '../lib/components/CommentsView.svelte';
  import AccountsView from '../lib/components/AccountsView.svelte';
  import PoliciesView from '../lib/components/PoliciesView.svelte';
  import ReportsView from '../lib/components/ReportsView.svelte';
  import BillingView from '../lib/components/BillingView.svelte';
  import SettingsView from '../lib/components/SettingsView.svelte';
  import OnboardingModal from '../lib/components/OnboardingModal.svelte';
  import LogoutModal from '../lib/components/LogoutModal.svelte';
  import LoginView from '../lib/components/LoginView.svelte';
  import { toast } from '../lib/toast';

  let isAuthenticated: boolean = $state(false);
  let activePage: string = $state('dashboard');
  let activeWorkspace: string = $state('maujahit');
  let currentRole: UserRole = $state('owner');
  let currentUser: any = $state(null);
  let pendingReviewCount: number = $state(4);
  let isDarkMode: boolean = $state(false);
  let isLangEn: boolean = $state(false);
  let isMobileMenuOpen: boolean = $state(false);
  let isOnboardingOpen: boolean = $state(false);
  let isLogoutModalOpen: boolean = $state(false);

  async function refreshReviewCount() {
    try {
      const queue = await api.getReviewQueue(activeWorkspace);
      pendingReviewCount = queue.length;
    } catch {}
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('login') === 'true' || urlParams.get('action') === 'logout') {
        localStorage.removeItem('replyra_auth');
        localStorage.removeItem('replyra_role');
        localStorage.removeItem('replyra_user');
        isAuthenticated = false;
      } else {
        const auth = localStorage.getItem('replyra_auth');
        if (auth === 'true') {
          isAuthenticated = true;
          const savedRole = localStorage.getItem('replyra_role') as UserRole;
          if (savedRole) {
            currentRole = savedRole;
          }
          const savedUser = localStorage.getItem('replyra_user');
          if (savedUser) {
            try {
              currentUser = JSON.parse(savedUser);
            } catch {}
          }
          refreshReviewCount();
        } else {
          isAuthenticated = false;
        }
      }

      const savedTheme = localStorage.getItem('replyra_theme');
      if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDarkMode = true;
        document.documentElement.classList.add('dark');
      } else {
        isDarkMode = false;
        document.documentElement.classList.remove('dark');
      }
    }
  });

  function handleSelectPage(page: string) {
    activePage = page;
    isMobileMenuOpen = false;
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleLogoutSuccess() {
    isAuthenticated = false;
    currentUser = null;
    isLogoutModalOpen = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('replyra_auth');
      localStorage.removeItem('replyra_role');
      localStorage.removeItem('replyra_user');
      localStorage.removeItem('replyra_session');
    }
    toast.info(
      isLangEn ? 'Signed out of Replyra.' : 'Berhasil keluar dari akun Replyra.',
      isLangEn ? 'Signed Out' : 'Keluar Akun'
    );
  }

  function handleLogin(role: UserRole = 'owner', user?: any) {
    currentRole = role;
    if (user) currentUser = user;
    isAuthenticated = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('replyra_auth', 'true');
      localStorage.setItem('replyra_role', role);
      if (user) {
        localStorage.setItem('replyra_user', JSON.stringify(user));
      }
    }
    refreshReviewCount();
    toast.success(
      isLangEn
        ? `Signed in as ${user?.name || role} (${role})`
        : `Berhasil masuk sebagai ${user?.name || role} (${role})`,
      isLangEn ? 'Welcome Back' : 'Selamat Datang'
    );
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('replyra_theme', isDarkMode ? 'dark' : 'light');
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  function toggleLang() {
    isLangEn = !isLangEn;
  }
</script>

{#if !isAuthenticated}
  <LoginView
    {isLangEn}
    {isDarkMode}
    onLogin={handleLogin}
    onToggleTheme={toggleTheme}
    onToggleLang={toggleLang}
  />
{:else}
  <div class="flex min-h-screen flex-col bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100">
    <!-- Top Global Navbar -->
    <Navbar
      bind:activeWorkspace
      bind:currentRole
      bind:isDarkMode
      bind:isLangEn
      {pendingReviewCount}
      onToggleMobileMenu={() => (isMobileMenuOpen = !isMobileMenuOpen)}
      onOpenOnboarding={() => (isOnboardingOpen = true)}
      onSelectPage={handleSelectPage}
      onLogout={() => (isLogoutModalOpen = true)}
    />

    <!-- Main Container -->
    <div class="flex flex-1">
      <!-- Desktop Sidebar (Hidden on mobile) -->
      <Sidebar
        {activePage}
        {pendingReviewCount}
        {isLangEn}
        {currentRole}
        {currentUser}
        onSelectPage={handleSelectPage}
        onLogout={() => (isLogoutModalOpen = true)}
      />

    <!-- Main Content Area -->
    <main class="flex-1 overflow-x-hidden p-4 pb-24 sm:p-6 sm:pb-28 lg:p-8 lg:pb-12">
      <div class="mx-auto max-w-7xl">
        {#if activePage === 'dashboard'}
          <DashboardView
            workspaceSlug={activeWorkspace}
            {isLangEn}
            onSelectPage={handleSelectPage}
          />
        {:else if activePage === 'review'}
          <ReviewQueueView
            workspaceSlug={activeWorkspace}
            {currentRole}
            {isLangEn}
            onReviewed={refreshReviewCount}
          />
        {:else if activePage === 'comments'}
          <CommentsView
            workspaceSlug={activeWorkspace}
            {isLangEn}
          />
        {:else if activePage === 'accounts'}
          <AccountsView
            workspaceSlug={activeWorkspace}
            {isLangEn}
          />
        {:else if activePage === 'policies'}
          <PoliciesView
            workspaceSlug={activeWorkspace}
            {isLangEn}
          />
        {:else if activePage === 'reports'}
          <ReportsView
            workspaceSlug={activeWorkspace}
            {isLangEn}
          />
        {:else if activePage === 'billing'}
          <BillingView
            workspaceSlug={activeWorkspace}
            {isLangEn}
          />
        {:else if activePage === 'settings'}
          <SettingsView
            workspaceSlug={activeWorkspace}
            {isLangEn}
          />
        {/if}
      </div>
    </main>
  </div>

  <!-- Mobile Bottom Navigation (<= 640px) -->
  <BottomNav
    {activePage}
    {pendingReviewCount}
    {isLangEn}
    onSelectPage={handleSelectPage}
    onOpenMoreMenu={() => (isMobileMenuOpen = true)}
  />

  <!-- Mobile Drawer Menu (Slide-over for remaining items on mobile) -->
  {#if isMobileMenuOpen}
    <div class="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs lg:hidden">
      <div class="w-72 bg-white p-5 shadow-2xl dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2.5">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <MessageSquareQuote class="h-4 w-4" />
              </div>
              <span class="font-bold text-slate-900 dark:text-white">Menu Navigasi</span>
            </div>
            <button type="button" class="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onclick={() => (isMobileMenuOpen = false)}>
              <X class="h-5 w-5" />
            </button>
          </div>

          <nav class="space-y-1 text-sm font-medium">
            {#each [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'review', label: 'Antrean Review', icon: AlertCircle, count: pendingReviewCount },
              { id: 'comments', label: 'Semua Komentar', icon: MessageSquare },
              { id: 'accounts', label: 'Akun Terhubung', icon: Share2 },
              { id: 'policies', label: 'Aturan Balasan', icon: Sliders },
              { id: 'reports', label: 'Laporan & Ekspor', icon: BarChart3 },
              { id: 'billing', label: 'Langganan & Kuota', icon: CreditCard },
              { id: 'settings', label: 'Tim & Audit Log', icon: Settings }
            ] as item}
              {@const Icon = item.icon}
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition {activePage === item.id ? 'bg-red-500/10 text-[#d93025] font-bold dark:bg-red-500/20 dark:text-[#ea4335]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}"
                onclick={() => handleSelectPage(item.id)}
              >
                <div class="flex items-center gap-3">
                  <Icon class="h-4.5 w-4.5 {activePage === item.id ? 'text-[#ea4335]' : ''}" />
                  <span>{item.label}</span>
                </div>
                {#if item.count && item.count > 0}
                  <span class="rounded-full bg-[#ea4335]/15 px-2 py-0.5 text-xs font-bold text-[#d93025] dark:text-[#ea4335]">
                    {item.count}
                  </span>
                {/if}
              </button>
            {/each}
          </nav>
        </div>

        <div class="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            class="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs dark:bg-[#ea4335] hover:bg-slate-800 dark:hover:bg-[#d93025] transition-colors"
            onclick={() => {
              isMobileMenuOpen = false;
              isOnboardingOpen = true;
            }}
          >
            Setup Brand Baru
          </button>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-red-50 hover:text-[#d93025] dark:border-slate-800 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-[#ea4335] active:scale-98"
            onclick={() => {
              isMobileMenuOpen = false;
              isLogoutModalOpen = true;
            }}
          >
            <LogOut class="h-4 w-4" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Tutup Menu"
        class="flex-1 cursor-default border-none bg-transparent"
        onclick={() => (isMobileMenuOpen = false)}
      ></button>
    </div>
  {/if}

  <!-- Onboarding Wizard Modal -->
  <OnboardingModal
    bind:isOpen={isOnboardingOpen}
    onClose={() => (isOnboardingOpen = false)}
    {isLangEn}
  />

  <!-- Global Logout Confirmation Modal (Desktop & Mobile) -->
  <LogoutModal
    bind:isOpen={isLogoutModalOpen}
    {isLangEn}
    {currentUser}
    {currentRole}
    onSuccess={handleLogoutSuccess}
  />
</div>
{/if}

