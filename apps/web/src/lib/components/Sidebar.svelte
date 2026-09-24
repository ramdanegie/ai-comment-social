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
    LogOut,
    PanelLeftClose,
    PanelLeftOpen
  } from 'lucide-svelte';
  import type { UserRole } from '../types';

  let {
    activePage = 'dashboard',
    pendingReviewCount = 4,
    isLangEn = false,
    isCollapsed = $bindable(false),
    currentRole = 'owner' as UserRole,
    currentUser = null,
    onSelectPage = () => {},
    onLogout = () => {}
  }: {
    activePage?: string;
    pendingReviewCount?: number;
    isLangEn?: boolean;
    isCollapsed?: boolean;
    currentRole?: UserRole;
    currentUser?: { id?: string; name?: string; email?: string } | null;
    onSelectPage?: (page: string) => void;
    onLogout?: () => void;
  } = $props();

  const userName = $derived(
    currentUser?.name || (currentRole === 'owner' ? 'Budi Santoso' : currentRole === 'admin' ? 'Siti Rahma' : 'Dewi Lestari')
  );
  const userEmail = $derived(
    currentUser?.email || (currentRole === 'owner' ? 'budi@maujahit.id' : currentRole === 'admin' ? 'siti@maujahit.id' : 'dewi@maujahit.id')
  );
  const userInitials = $derived(
    userName
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  );
  const roleLabel = $derived(currentRole === 'owner' ? 'Owner' : currentRole === 'admin' ? 'Admin' : 'Viewer');

  onMount(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('replyra_sidebar_collapsed');
      if (saved !== null) {
        isCollapsed = saved === 'true';
      }
    }
  });

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    if (typeof window !== 'undefined') {
      localStorage.setItem('replyra_sidebar_collapsed', String(isCollapsed));
    }
  }

  const navItems = [
    { id: 'dashboard', labelId: 'Dashboard', labelEn: 'Dashboard', icon: LayoutDashboard },
    { id: 'review', labelId: 'Antrean Review', labelEn: 'Review Queue', icon: AlertCircle, badgeKey: 'review' },
    { id: 'comments', labelId: 'Semua Komentar', labelEn: 'All Comments', icon: MessageSquare },
    { id: 'accounts', labelId: 'Akun Terhubung', labelEn: 'Social Accounts', icon: Share2 },
    { id: 'policies', labelId: 'Aturan Balasan', labelEn: 'Reply Policies', icon: Sliders },
    { id: 'reports', labelId: 'Laporan & Ekspor', labelEn: 'Reports & Export', icon: BarChart3 },
    { id: 'billing', labelId: 'Kuota & Paket', labelEn: 'Billing & Quota', icon: CreditCard },
    { id: 'settings', labelId: 'Tim & Audit Log', labelEn: 'Team & Audit', icon: Settings }
  ];

  function handleLogout() {
    onLogout();
  }
</script>

<aside
  class="sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col justify-between border-r border-slate-200/60 bg-white/80 backdrop-blur-xl transition-all duration-300 ease-in-out dark:border-slate-800/60 dark:bg-[#0b0f17]/85 lg:flex {isCollapsed ? 'w-20 p-2.5' : 'w-64 p-3.5'}"
  aria-label="Sidebar Navigasi"
>
  <!-- Top: Brand Header & Navigation -->
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pr-0.5">
    {#if !isCollapsed}
      <!-- Expanded Brand Header Card -->
      <div class="mb-4 rounded-xl border border-slate-200/60 bg-slate-50/60 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50 transition-all shadow-2xs">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
              <img
                src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=120&h=120&fit=crop"
                alt="MauJahit"
                class="h-full w-full object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-xs font-bold text-slate-900 dark:text-white">MauJahit.id</h2>
              <div class="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{isLangEn ? 'Assisted' : 'Mode Terpandu'}</span>
              </div>
            </div>
          </div>

          <!-- Collapse Trigger Button -->
          <button
            type="button"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
            onclick={toggleCollapse}
            title={isLangEn ? 'Collapse sidebar' : 'Perkecil sidebar'}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose class="h-4 w-4" />
          </button>
        </div>
      </div>
    {:else}
      <!-- Collapsed Brand Header -->
      <div class="mb-4 flex flex-col items-center gap-2">
        <div
          class="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-xs"
          title="MauJahit.id • Mode Terpandu"
        >
          <img
            src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=120&h=120&fit=crop"
            alt="MauJahit"
            class="h-full w-full object-cover"
          />
        </div>

        <!-- Expand Trigger Button -->
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50/70 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors shadow-xs"
          onclick={toggleCollapse}
          title={isLangEn ? 'Expand sidebar' : 'Perluas sidebar'}
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen class="h-4 w-4" />
        </button>
      </div>
    {/if}

    <!-- Navigation List -->
    <nav class="space-y-1">
      {#each navItems as item}
        {@const isActive = activePage === item.id}
        {@const Icon = item.icon}
        {@const label = isLangEn ? item.labelEn : item.labelId}

        {#if !isCollapsed}
          <!-- Expanded Nav Button -->
          <button
            type="button"
            class="group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all {isActive
              ? 'bg-brand-500/10 text-brand-600 shadow-2xs dark:bg-brand-500/15 dark:text-brand-500 border border-brand-500/20'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'}"
            onclick={() => onSelectPage(item.id)}
          >
            <div class="flex items-center gap-3 min-w-0">
              <Icon
                class="h-4 w-4 shrink-0 transition-colors {isActive ? 'text-brand-500 dark:text-brand-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}"
              />
              <span class="truncate">{label}</span>
            </div>

            {#if item.badgeKey === 'review' && pendingReviewCount > 0}
              <span class="flex h-4.5 items-center justify-center rounded-full bg-brand-500/15 px-1.5 text-[10px] font-bold text-brand-600 dark:text-brand-500">
                {pendingReviewCount}
              </span>
            {/if}
          </button>
        {:else}
          <!-- Collapsed Nav Button (Icon + Tooltip) -->
          <button
            type="button"
            class="relative flex h-10 w-full items-center justify-center rounded-xl text-xs font-semibold transition-all {isActive
              ? 'bg-brand-500/10 text-brand-600 shadow-2xs dark:bg-brand-500/15 dark:text-brand-500 border border-brand-500/20'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'}"
            onclick={() => onSelectPage(item.id)}
            title={label}
            aria-label={label}
          >
            <Icon
              class="h-4.5 w-4.5 shrink-0 transition-colors {isActive ? 'text-brand-500 dark:text-brand-500' : 'text-slate-400 dark:text-slate-500'}"
            />

            {#if item.badgeKey === 'review' && pendingReviewCount > 0}
              <span class="absolute top-2 right-2 flex h-2 w-2">
                <span class="h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-slate-950"></span>
              </span>
            {/if}
          </button>
        {/if}
      {/each}
    </nav>
  </div>

  <!-- Bottom Pinned Section: AI Quota + User Profile + Logout (Permanently at bottom-left) -->
  <div class="shrink-0 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800/80">
    {#if !isCollapsed}
      <!-- Expanded: AI Units Mini Progress Card -->
      <button
        type="button"
        class="w-full text-left rounded-xl border border-slate-200/70 bg-slate-50/70 p-2.5 transition hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-900/60 dark:hover:border-slate-700"
        onclick={() => onSelectPage('billing')}
        title="Lihat detail penggunaan kuota"
      >
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-slate-500 dark:text-slate-400">{isLangEn ? 'AI Quota' : 'Kuota AI'}</span>
          <span class="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">1.420 / 5.450</span>
        </div>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div class="h-full rounded-full bg-brand-500 transition-all duration-300" style="width: 26%"></div>
        </div>
        <div class="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>26% Terpakai</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-medium">Aktif</span>
        </div>
      </button>

      <!-- Expanded: User Account Info -->
      <div class="space-y-1">
        <div class="flex items-center justify-between rounded-xl px-2 py-1.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
              {userInitials}
            </div>
            <div class="min-w-0">
              <p class="truncate text-xs font-bold text-slate-900 dark:text-white">{userName}</p>
              <p class="truncate text-[10px] text-slate-400 dark:text-slate-500">{userEmail}</p>
            </div>
          </div>
          <span class="rounded-md border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {roleLabel}
          </span>
        </div>

        <!-- Logout Button -->
        <button
          type="button"
          class="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-500 active:scale-98"
          onclick={handleLogout}
          title={isLangEn ? 'Log out of your account' : 'Keluar dari akun Anda'}
        >
          <LogOut class="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-rose-500 dark:group-hover:text-rose-500" />
          <span>{isLangEn ? 'Log Out' : 'Keluar Akun'}</span>
        </button>
      </div>
    {:else}
      <!-- Collapsed: AI Quota Compact Icon Button -->
      <button
        type="button"
        class="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200/70 bg-slate-50/70 text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800"
        onclick={() => onSelectPage('billing')}
        title={isLangEn ? 'AI Quota' : 'Kuota AI'}
        aria-label="Kuota AI"
      >
        <div class="relative">
          <CreditCard class="h-4.5 w-4.5 text-brand-500 dark:text-brand-500" />
          <span class="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900"></span>
        </div>
      </button>

      <!-- Collapsed: Avatar + Compact Logout Button -->
      <div class="flex flex-col items-center gap-1.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 shadow-xs cursor-default"
          title="{userName} ({roleLabel}) • {userEmail}"
        >
          {userInitials}
        </div>

        <button
          type="button"
          class="flex h-9 w-full items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-500 active:scale-98"
          onclick={handleLogout}
          title={isLangEn ? 'Log Out' : 'Keluar Akun'}
          aria-label="Keluar Akun"
        >
          <LogOut class="h-4.5 w-4.5 shrink-0 text-slate-400 hover:text-rose-500 dark:hover:text-rose-500" />
        </button>
      </div>
    {/if}
  </div>
</aside>

