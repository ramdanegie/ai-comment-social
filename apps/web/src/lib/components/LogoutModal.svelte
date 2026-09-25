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
    currentUser?.name || currentUser?.email || ''
  );
  const userEmail = $derived(
    currentUser?.email || ''
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
      class="glass-panel relative z-10 w-full max-w-md p-6 sm:p-7 transition-all"
    >
      <!-- Top Close Button -->
      <button
        type="button"
        class="absolute right-4.5 top-4.5 rounded-full p-2 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        onclick={closeModal}
        aria-label="Tutup"
      >
        <X class="h-4.5 w-4.5" />
      </button>

      <!-- Icon & Headline -->
      <div class="flex items-start gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/25 shadow-xs">
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
      <div class="mt-4 flex items-center justify-between rounded-2xl border border-white/60 bg-white/40 p-3 dark:border-white/10 dark:bg-white/5 backdrop-blur-sm">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900 shadow-2xs">
            {userInitials}
          </div>
          <div class="min-w-0">
            <p class="truncate text-xs font-bold text-slate-900 dark:text-white">{userName}</p>
            <p class="truncate text-[10px] text-slate-400 font-mono">{userEmail}</p>
          </div>
        </div>
        <span class="rounded-full border border-white/60 bg-white/60 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
          {roleLabel}
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex items-center justify-end gap-2.5">
        <button
          type="button"
          class="glass-pill px-4.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          onclick={closeModal}
          disabled={isLoggingOut}
        >
          {isLangEn ? 'Cancel' : 'Batal'}
        </button>

        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-700 active:scale-95 disabled:opacity-60"
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
