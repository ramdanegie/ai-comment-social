<script lang="ts">
  import { LogOut, X, Loader2, ShieldAlert } from 'lucide-svelte';
  import type { UserRole } from '../types';

  let {
    isOpen = $bindable(false),
    isLangEn = false,
    currentUser = null,
    currentRole = 'owner' as UserRole,
    onSuccess = () => {}
  }: {
    isOpen: boolean;
    isLangEn?: boolean;
    currentUser?: { id?: string; name?: string; email?: string } | null;
    currentRole?: UserRole;
    onSuccess?: () => void;
  } = $props();

  let isLoggingOut = $state(false);

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

  function closeModal() {
    if (isLoggingOut) return;
    isOpen = false;
  }

  function handleConfirmLogout() {
    isLoggingOut = true;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('replyra_auth');
      localStorage.removeItem('replyra_role');
      localStorage.removeItem('replyra_user');
      localStorage.removeItem('replyra_session');
    }
    setTimeout(() => {
      isLoggingOut = false;
      isOpen = false;
      onSuccess();
    }, 150);
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
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200"
    role="dialog"
    aria-modal="true"
    aria-labelledby="logout-title"
  >
    <!-- Backdrop Click to Close -->
    <button
      type="button"
      class="fixed inset-0 h-full w-full cursor-default bg-transparent border-none"
      onclick={closeModal}
      aria-label="Tutup modal"
    ></button>

    <!-- Modal Content Card -->
    <div
      class="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
    >
      <!-- Top Close Button -->
      <button
        type="button"
        class="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        onclick={closeModal}
        aria-label="Tutup"
      >
        <X class="h-4.5 w-4.5" />
      </button>

      <!-- Icon & Headline -->
      <div class="flex items-start gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-500 border border-rose-500/20">
          <LogOut class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1 pr-6">
          <h3 id="logout-title" class="text-base font-bold text-slate-900 dark:text-white">
            {isLangEn ? 'Sign out of Replyra?' : 'Keluar dari Akun Replyra?'}
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {isLangEn
              ? 'Your active session will be ended. Your settings and comment queue remain safe.'
              : 'Sesi kerja Anda saat ini akan diakhiri. Seluruh aturan balasan dan riwayat moderasi tetap tersimpan aman.'}
          </p>
        </div>
      </div>

      <!-- User Account Info Preview Pill (Dynamic from Database) -->
      <div class="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-850/60">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
            {userInitials}
          </div>
          <div class="min-w-0">
            <p class="truncate text-xs font-bold text-slate-900 dark:text-white">{userName}</p>
            <p class="truncate text-[10px] text-slate-400 font-mono">{userEmail}</p>
          </div>
        </div>
        <span class="rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {roleLabel}
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex items-center justify-end gap-2.5">
        <button
          type="button"
          class="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95"
          onclick={closeModal}
          disabled={isLoggingOut}
        >
          {isLangEn ? 'Cancel' : 'Batal'}
        </button>

        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600 active:scale-98 disabled:opacity-60"
          onclick={handleConfirmLogout}
          disabled={isLoggingOut}
        >
          {#if isLoggingOut}
            <Loader2 class="h-4 w-4 animate-spin" />
            <span>{isLangEn ? 'Signing out...' : 'Mengakhiri Sesi...'}</span>
          {:else}
            <LogOut class="h-4 w-4" />
            <span>{isLangEn ? 'Sign Out' : 'Ya, Keluar Akun'}</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
