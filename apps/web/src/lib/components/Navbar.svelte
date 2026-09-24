<script lang="ts">
  import { onMount } from 'svelte';
  import {
    MessageSquareQuote,
    Sun,
    Moon,
    Menu,
    Plus,
    Bell,
    ChevronDown,
    LogOut
  } from 'lucide-svelte';
  import { api } from '../api';
  import type { UserRole } from '../types';

  let {
    activeWorkspace = $bindable('maujahit'),
    currentRole = $bindable('owner' as UserRole),
    pendingReviewCount = 4,
    isDarkMode = $bindable(false),
    isLangEn = $bindable(false),
    onToggleMobileMenu = () => {},
    onOpenOnboarding = () => {},
    onSelectPage = () => {},
    onLogout = () => {}
  }: {
    activeWorkspace?: string;
    currentRole?: UserRole;
    pendingReviewCount?: number;
    isDarkMode?: boolean;
    isLangEn?: boolean;
    onToggleMobileMenu?: () => void;
    onOpenOnboarding?: () => void;
    onSelectPage?: (page: string) => void;
    onLogout?: () => void;
  } = $props();

  let workspaces: Array<{ id: string; name: string; slug: string }> = $state([]);

  async function loadWorkspaces() {
    try {
      workspaces = await api.getWorkspaces();
    } catch {}
  }

  onMount(loadWorkspaces);

  function toggleDark() {
    isDarkMode = !isDarkMode;
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('replyra_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('replyra_theme', 'light');
      }
    }
  }

  function toggleLang() {
    isLangEn = !isLangEn;
  }
</script>

<header class="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-xl transition-colors duration-200 dark:border-slate-800/60 dark:bg-[#0b0f17]/80 sm:px-6">
  <!-- Left: Brand & Mobile Menu Button -->
  <div class="flex items-center gap-3">
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white/70 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden shadow-xs"
      onclick={onToggleMobileMenu}
      aria-label="Buka menu navigasi"
    >
      <Menu class="h-4.5 w-4.5" />
    </button>

    <div class="flex items-center gap-2.5">
      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-xs dark:bg-white dark:text-slate-950">
        <MessageSquareQuote class="h-4.5 w-4.5" />
      </div>
      <div>
        <div class="flex items-center gap-1.5">
          <span class="text-base font-bold tracking-tight text-slate-900 dark:text-white">Replyra</span>
          <span class="rounded-md border border-slate-200/60 bg-slate-100/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-400">SaaS</span>
        </div>
        <p class="hidden text-[10px] text-slate-400 dark:text-slate-500 sm:block leading-none mt-0.5 font-medium">
          {isLangEn ? 'Comment Moderation' : 'Moderasi & Balasan Komentar'}
        </p>
      </div>
    </div>

    <!-- Workspace Selector -->
    <div class="ml-2 hidden items-center gap-1.5 sm:flex">
      <span class="text-slate-300 dark:text-slate-700">/</span>
      <div class="relative">
        <select
          bind:value={activeWorkspace}
          class="h-8 appearance-none rounded-xl border border-slate-200/70 bg-slate-50/70 pl-2.5 pr-7 text-xs font-semibold text-slate-700 transition hover:border-slate-300 focus:border-[#ea4335] focus:outline-none dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-200 shadow-xs"
        >
          {#each workspaces as ws}
            <option value={ws.slug} class="dark:bg-slate-900">{ws.name}</option>
          {/each}
        </select>
        <ChevronDown class="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-slate-400" />
      </div>
    </div>
  </div>

  <!-- Right: Actions, Role Switcher, Alerts, Theme, Language -->
  <div class="flex items-center gap-2 sm:gap-2.5">
    <!-- Setup Brand Button -->
    <button
      type="button"
      class="hidden items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-98 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800 md:inline-flex"
      onclick={onOpenOnboarding}
    >
      <Plus class="h-3.5 w-3.5" />
      <span>{isLangEn ? 'New Brand' : 'Brand Baru'}</span>
    </button>

    <!-- Role Switcher (Simulates Owner / Admin / Viewer permissions) -->
    <div class="flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-2.5 py-1 text-xs dark:border-slate-800/70 dark:bg-slate-900/60 shadow-xs">
      <span class="hidden text-[11px] font-medium text-slate-400 sm:inline">Role:</span>
      <select
        bind:value={currentRole}
        class="border-none bg-transparent p-0 text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-200 cursor-pointer"
        title="Ubah role pengguna untuk menguji hak akses (Owner, Admin, Viewer)"
      >
        <option value="owner" class="dark:bg-slate-900">Owner (Budi)</option>
        <option value="admin" class="dark:bg-slate-900">Admin (Siti)</option>
        <option value="viewer" class="dark:bg-slate-900">Viewer (Dewi)</option>
      </select>
    </div>

    <!-- Review Alert Badge Icon -->
    <button
      type="button"
      class="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 shadow-xs active:scale-95"
      onclick={() => onSelectPage('review')}
      title="{pendingReviewCount} komentar perlu review"
    >
      <Bell class="h-4 w-4" />
      {#if pendingReviewCount > 0}
        <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ea4335] text-[9px] font-bold text-white shadow-xs">
          {pendingReviewCount}
        </span>
      {/if}
    </button>

    <!-- Language Toggle -->
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 shadow-xs active:scale-95"
      onclick={toggleLang}
      title="Ubah bahasa (ID / EN)"
    >
      {isLangEn ? 'EN' : 'ID'}
    </button>

    <!-- Dark Mode Toggle -->
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 shadow-xs active:scale-95"
      onclick={toggleDark}
      aria-label="Toggle tema gelap atau terang"
    >
      {#if isDarkMode}
        <Sun class="h-4 w-4 text-amber-400 transition-transform duration-200 rotate-0" />
      {:else}
        <Moon class="h-4 w-4 transition-transform duration-200 -rotate-12" />
      {/if}
    </button>

    <!-- Logout / Switch Account Button -->
    <button
      type="button"
      class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/80 px-2.5 text-xs font-semibold text-slate-600 transition-all hover:border-red-300 hover:bg-red-50 hover:text-[#d93025] dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:text-[#ea4335] shadow-xs active:scale-95"
      onclick={onLogout}
      title={isLangEn ? 'Sign Out / Switch Account' : 'Keluar Akun / Ganti Profil'}
      aria-label="Keluar Akun"
    >
      <div class="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
        {currentRole === 'owner' ? 'BS' : currentRole === 'admin' ? 'SA' : 'DL'}
      </div>
      <span class="hidden md:inline">{isLangEn ? 'Sign Out' : 'Keluar'}</span>
      <LogOut class="h-3.5 w-3.5" />
    </button>
  </div>
</header>
