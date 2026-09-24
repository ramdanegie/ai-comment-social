<script lang="ts">
  import { AlertTriangle, X, Loader2 } from 'lucide-svelte';

  let {
    isOpen = $bindable(false),
    title = 'Konfirmasi Tindakan',
    message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
    confirmText = 'Konfirmasi',
    cancelText = 'Batal',
    isDanger = true,
    onConfirm = () => {}
  }: {
    isOpen: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm?: () => Promise<void> | void;
  } = $props();

  let isSubmitting = $state(false);

  function closeModal() {
    if (isSubmitting) return;
    isOpen = false;
  }

  async function handleConfirm() {
    isSubmitting = true;
    try {
      await onConfirm();
      isOpen = false;
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      closeModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-modal-title"
  >
    <button
      type="button"
      class="fixed inset-0 h-full w-full cursor-default bg-transparent border-none"
      onclick={closeModal}
      aria-label="Tutup modal"
    ></button>

    <div
      class="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        class="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        onclick={closeModal}
        aria-label="Tutup"
      >
        <X class="h-4.5 w-4.5" />
      </button>

      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl {isDanger
            ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 border border-rose-500/20'
            : 'bg-[#1a73e8]/10 text-[#1a73e8] dark:bg-[#1a73e8]/20 border border-[#1a73e8]/20'}"
        >
          <AlertTriangle class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1 pr-6">
          <h3 id="confirm-modal-title" class="text-base font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      <div class="mt-6 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onclick={closeModal}
          disabled={isSubmitting}
          class="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onclick={handleConfirm}
          disabled={isSubmitting}
          class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 active:scale-98 {isDanger
            ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
            : 'bg-[#1a73e8] hover:bg-[#1557b0] shadow-[#1a73e8]/20'}"
        >
          {#if isSubmitting}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            <span>Memproses...</span>
          {:else}
            <span>{confirmText}</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
