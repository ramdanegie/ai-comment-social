<script lang="ts">
  import { toast, type ToastItem } from '$lib/toast';
  import { CheckCircle2, AlertCircle, Info, X } from 'lucide-svelte';
  import { fly, fade } from 'svelte/transition';

  let items: ToastItem[] = $state([]);

  $effect(() => {
    const unsub = toast.subscribe((val) => {
      items = val;
    });
    return unsub;
  });
</script>

<aside aria-label="Notifikasi" class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0">
  {#each items as item (item.id)}
    <div
      in:fly={{ y: 20, duration: 250 }}
      out:fade={{ duration: 150 }}
      class="pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white/95 p-3.5 shadow-xl backdrop-blur-md transition-all dark:bg-slate-900/95 {
        item.type === 'error'
          ? 'border-rose-500/30 shadow-rose-500/10'
          : item.type === 'success'
          ? 'border-[#1e8e3e]/30 shadow-[#1e8e3e]/10'
          : item.type === 'warning'
          ? 'border-[#f9ab00]/30 shadow-[#f9ab00]/10'
          : 'border-[#1a73e8]/30 shadow-[#1a73e8]/10'
      }"
      role="alert"
    >
      <!-- Icon Indicator with Google Brand Color -->
      <div
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl {
          item.type === 'error'
            ? 'bg-rose-500/12 text-rose-500'
            : item.type === 'success'
            ? 'bg-[#1e8e3e]/12 text-[#1e8e3e]'
            : item.type === 'warning'
            ? 'bg-[#f9ab00]/15 text-[#f9ab00]'
            : 'bg-[#1a73e8]/12 text-[#1a73e8]'
        }"
      >
        {#if item.type === 'error' || item.type === 'warning'}
          <AlertCircle class="h-4 w-4" />
        {:else if item.type === 'success'}
          <CheckCircle2 class="h-4 w-4" />
        {:else}
          <Info class="h-4 w-4" />
        {/if}
      </div>

      <!-- Text Content -->
      <div class="min-w-0 flex-1 pt-0.5">
        {#if item.title}
          <h4 class="text-xs font-bold text-slate-900 dark:text-white leading-tight">
            {item.title}
          </h4>
        {/if}
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal {item.title ? 'mt-0.5' : ''}">
          {item.message}
        </p>
      </div>

      <!-- Close Button -->
      <button
        type="button"
        class="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        onclick={() => toast.remove(item.id)}
        aria-label="Tutup notifikasi"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>
  {/each}
</aside>
