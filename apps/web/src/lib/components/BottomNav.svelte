<script lang="ts">
  import {
    LayoutDashboard,
    AlertCircle,
    MessageSquare,
    Sliders,
    MoreHorizontal
  } from 'lucide-svelte';
  import { pathFor } from '../nav';

  let {
    activePage = 'dashboard',
    pendingReviewCount = 4,
    isLangEn = false,
    onSelectPage = () => {},
    onOpenMoreMenu = () => {}
  }: {
    activePage?: string;
    pendingReviewCount?: number;
    isLangEn?: boolean;
    onSelectPage?: (page: string) => void;
    onOpenMoreMenu?: () => void;
  } = $props();

  const bottomItems = [
    { id: 'dashboard', labelId: 'Dashboard', labelEn: 'Dashboard', icon: LayoutDashboard },
    { id: 'review', labelId: 'Review', labelEn: 'Review', icon: AlertCircle, badgeKey: 'review' },
    { id: 'comments', labelId: 'Komentar', labelEn: 'Comments', icon: MessageSquare },
    { id: 'policies', labelId: 'Aturan', labelEn: 'Policy', icon: Sliders }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md pb-safe dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
  {#each bottomItems as item}
    {@const isActive = activePage === item.id}
    {@const Icon = item.icon}
    <a
      href={pathFor(item.id)}
      aria-current={isActive ? 'page' : undefined}
      class="relative flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium transition-colors {isActive
        ? 'text-brand-500 dark:text-brand-400 font-semibold'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}"
      onclick={() => onSelectPage(item.id)}
    >
      <div class="relative">
        <Icon class="h-5 w-5" />
        {#if item.badgeKey === 'review' && pendingReviewCount > 0}
          <span class="absolute -top-1.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white shadow-xs">
            {pendingReviewCount}
          </span>
        {/if}
      </div>
      <span class="mt-1 leading-none">{isLangEn ? item.labelEn : item.labelId}</span>
    </a>
  {/each}

  <button
    type="button"
    class="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
    onclick={onOpenMoreMenu}
  >
    <MoreHorizontal class="h-5 w-5" />
    <span class="mt-1 leading-none">{isLangEn ? 'More' : 'Lainnya'}</span>
  </button>
</nav>
