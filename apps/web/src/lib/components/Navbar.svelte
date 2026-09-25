<script lang="ts">
  import { onMount } from 'svelte';
  import {
    MessageSquareQuote,
    Sun,
    Moon,
    Menu,
    Plus,
    Bell,
    ChevronDown
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

<header class="app-navbar glass-chrome sticky top-0 z-40 flex w-full items-center justify-between gap-3 px-4 sm:px-6">
  <!-- Left: Brand & Mobile Menu Button -->
  <div class="flex items-center gap-3">
    <button
      type="button"
      class="glass-pill inline-flex h-10 w-10 items-center justify-center text-slate-700 dark:text-slate-200 lg:hidden shadow-xs"
      onclick={onToggleMobileMenu}
      aria-label="Buka menu navigasi"
    >
      <Menu class="h-4.5 w-4.5" />
    </button>

    <div class="flex items-center gap-2.5">
      <div class="flex h-10 w-10 items-center justify-center brand-mark rounded-2xl text-white shadow-xs">
        <MessageSquareQuote class="h-4.5 w-4.5" />
      </div>
      <div>
        <div class="flex items-center gap-1.5">
          <span class="text-base font-bold tracking-tight text-slate-900 dark:text-white">Replyra</span>
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
          aria-label={isLangEn ? 'Workspace' : 'Workspace aktif'}
          bind:value={activeWorkspace}
          class="h-8 appearance-none rounded-full border border-white/60 bg-white/50 pl-3 pr-7 text-xs font-semibold text-slate-700 transition hover:bg-white/80 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 shadow-2xs backdrop-blur-xs"
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
      class="glass-pill hidden items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 md:inline-flex shadow-xs"
      onclick={onOpenOnboarding}
    >
      <Plus class="h-3.5 w-3.5" />
      <span>{isLangEn ? 'New Brand' : 'Brand Baru'}</span>
    </button>


    <!-- Review Alert Badge Icon -->
    <button
      type="button"
      class="glass-pill relative inline-flex h-10 w-10 items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs"
      onclick={() => onSelectPage('review')}
      title="{pendingReviewCount} komentar perlu review"
      aria-label="{pendingReviewCount} komentar perlu review"
    >
      <Bell class="h-4 w-4" />
      {#if pendingReviewCount > 0}
        <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white shadow-xs">
          {pendingReviewCount}
        </span>
      {/if}
    </button>

    <!-- Language Toggle -->
    <button
      type="button"
      class="glass-pill inline-flex h-10 w-10 items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs"
      onclick={toggleLang}
      title="Ubah bahasa (ID / EN)"
      aria-label="Ubah bahasa"
    >
      {isLangEn ? 'EN' : 'ID'}
    </button>

    <!-- Dark Mode Toggle -->
    <button
      type="button"
      class="glass-pill inline-flex h-10 w-10 items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs"
      onclick={toggleDark}
      aria-label="Toggle tema gelap atau terang"
    >
      {#if isDarkMode}
        <Sun class="h-4 w-4 text-amber-400 transition-transform duration-200 rotate-0" />
      {:else}
        <Moon class="h-4 w-4 transition-transform duration-200 -rotate-12" />
      {/if}
    </button>

  </div>
</header>
