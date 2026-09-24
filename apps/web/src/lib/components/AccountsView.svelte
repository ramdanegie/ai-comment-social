<script lang="ts">
  import { onMount } from 'svelte';
  import {
    CheckCircle2,
    AlertCircle,
    Plus,
    RefreshCw,
    Trash2,
    Shield,
    ExternalLink,
    Lock,
    Key
  } from 'lucide-svelte';
  import InstagramIcon from './icons/InstagramIcon.svelte';
  import FacebookIcon from './icons/FacebookIcon.svelte';
  import ConfirmModal from './ConfirmModal.svelte';
  import { api } from '../api';
  import type { SocialAccount, Platform } from '../types';
  import { toast } from '$lib/toast';

  let {
    workspaceSlug = 'maujahit',
    isLangEn = false
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
  } = $props();

  let accounts: SocialAccount[] = $state([]);
  let loading: boolean = $state(true);
  let isConnecting: boolean = $state(false);
  let showConnectModal: boolean = $state(false);

  // Disconnect modal state
  let isDisconnectModalOpen: boolean = $state(false);
  let accountToDisconnect: SocialAccount | null = $state(null);

  // New connection form
  let newPlatform: Platform = $state('instagram');
  let newUsername: string = $state('');
  let newExternalId: string = $state('');

  async function loadAccounts() {
    loading = true;
    try {
      accounts = await api.getAccounts(workspaceSlug);
    } finally {
      loading = false;
    }
  }

  onMount(loadAccounts);

  async function handleConnectAccount() {
    if (!newUsername.trim()) return;
    isConnecting = true;
    try {
      // simulate OAuth token exchange
      await api.connectAccount(workspaceSlug, {
        platform: newPlatform,
        username: newUsername.trim(),
        externalId: newExternalId || `ext_${Date.now()}`,
        accessToken: `meta_oauth_token_${Date.now()}`
      });
      showConnectModal = false;
      newUsername = '';
      await loadAccounts();
      toast.success(
        isLangEn ? 'Social account connected successfully!' : 'Akun media sosial berhasil dihubungkan!',
        isLangEn ? 'Connected' : 'Terhubung'
      );
    } finally {
      isConnecting = false;
    }
  }

  function handleDisconnectClick(acc: SocialAccount) {
    accountToDisconnect = acc;
    isDisconnectModalOpen = true;
  }

  async function handleConfirmDisconnect() {
    if (!accountToDisconnect) return;
    try {
      await api.disconnectAccount(workspaceSlug, accountToDisconnect.id);
      toast.success(
        isLangEn
          ? `Account @${accountToDisconnect.username} disconnected.`
          : `Koneksi akun @${accountToDisconnect.username} berhasil diputuskan.`,
        isLangEn ? 'Disconnected' : 'Berhasil Diputus'
      );
      accountToDisconnect = null;
      await loadAccounts();
    } catch {
      toast.error(
        isLangEn ? 'Failed to disconnect account.' : 'Gagal memutuskan koneksi akun.',
        'Error'
      );
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {isLangEn ? 'Connected Social Channels' : 'Akun Media Sosial Terhubung'}
      </h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Manage Instagram Professional, Facebook Pages, and organic TikTok permissions'
          : 'Kelola koneksi token Meta (IG/FB) dan permission webhook komentar MauJahit.id'}
      </p>
    </div>

    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl bg-[#ea4335] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d93025] active:scale-95"
      onclick={() => (showConnectModal = true)}
    >
      <Plus class="h-4 w-4" />
      <span>{isLangEn ? 'Connect New Account' : 'Hubungkan Akun Baru'}</span>
    </button>
  </div>

  <!-- Accounts Cards List -->
  {#if loading}
    <div class="space-y-4">
      {#each [1, 2] as _}
        <div class="h-32 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each accounts as acc}
        <div class="soft-card soft-card-hover p-5.5">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3.5">
              <div class="relative">
                <div class="h-12 w-12 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {#if acc.avatarUrl}
                    <img src={acc.avatarUrl} alt={acc.username} class="h-full w-full object-cover" />
                  {/if}
                </div>
                <div class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-xs dark:bg-slate-800">
                  {#if acc.platform === 'instagram'}
                    <InstagramIcon class="h-3.5 w-3.5 text-pink-500" />
                  {:else if acc.platform === 'facebook'}
                    <FacebookIcon class="h-3.5 w-3.5 text-blue-600" />
                  {:else}
                    <span class="text-[9px] font-bold text-slate-800 dark:text-slate-200">TT</span>
                  {/if}
                </div>
              </div>

              <div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                  {acc.username}
                </h3>
                <p class="text-xs text-slate-400 capitalize">{acc.platform} • ID: {acc.externalId}</p>

                <!-- Status indicator -->
                <div class="mt-1 flex items-center gap-1.5 text-xs font-medium">
                  {#if acc.status === 'connected'}
                    <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span class="text-emerald-700 dark:text-emerald-400">Token Aktif & Sinkron</span>
                  {:else if acc.status === 'pending_approval'}
                    <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                    <span class="text-amber-700 dark:text-amber-400">Fase 2 (Menunggu Approval TikTok)</span>
                  {:else}
                    <span class="h-2 w-2 rounded-full bg-[#ea4335]"></span>
                    <span class="text-[#ea4335] dark:text-red-400">Token Kedaluwarsa</span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Disconnect / Reconnect menu -->
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-[#ea4335]/10 hover:text-[#ea4335] transition-colors"
              onclick={() => handleDisconnectClick(acc)}
              title="Putus koneksi akun"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>

          <!-- Permissions & Webhook Status -->
          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="flex flex-wrap items-center justify-between text-xs text-slate-500">
              <div class="flex items-center gap-1.5">
                <Shield class="h-3.5 w-3.5 text-emerald-600" />
                <span>Webhook Subscribed (IG Comments & Feed)</span>
              </div>
              <span class="font-mono text-[11px]">
                Mode: <strong class="uppercase text-slate-800 dark:text-slate-200">{acc.policy?.mode || 'shadow'}</strong>
              </span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Connect Meta OAuth Modal -->
{#if showConnectModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <h3 class="text-base font-bold text-slate-900 dark:text-white">Hubungkan Saluran Media Sosial</h3>
      <p class="mt-1 text-xs text-slate-500">
        Hubungkan Instagram Bisnis atau Facebook Page resmi Anda untuk sinkronisasi komentar otomatis.
      </p>

      <div class="mt-4 space-y-4 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 dark:text-slate-300">Pilih Platform:</label>
          <div class="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-xl border p-2.5 font-semibold transition {newPlatform === 'instagram'
                ? 'border-[#ea4335] bg-[#ea4335]/5 text-[#b3261e] dark:bg-[#ea4335]/15 dark:text-red-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}"
              onclick={() => (newPlatform = 'instagram')}
            >
              <InstagramIcon class="h-4 w-4 text-pink-500" />
              <span>Instagram</span>
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-xl border p-2.5 font-semibold transition {newPlatform === 'facebook'
                ? 'border-[#ea4335] bg-[#ea4335]/5 text-[#b3261e] dark:bg-[#ea4335]/15 dark:text-red-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}"
              onclick={() => (newPlatform = 'facebook')}
            >
              <FacebookIcon class="h-4 w-4 text-blue-600" />
              <span>Facebook Page</span>
            </button>
          </div>
        </div>

        <div>
          <label for="newUsernameInput" class="block font-semibold text-slate-700 dark:text-slate-300">Username / Page Name:</label>
          <input
            id="newUsernameInput"
            type="text"
            placeholder="contoh: maujahit.official"
            bind:value={newUsername}
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-[#ea4335] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div class="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          <div class="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
            <Key class="h-3.5 w-3.5 text-[#ea4335]" />
            <span>Keamanan Token:</span>
          </div>
          <p class="mt-0.5">Koneksi akun Anda dilindungi dengan enkripsi keamanan standar industri.</p>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
          onclick={() => (showConnectModal = false)}
        >
          Batal
        </button>
        <button
          type="button"
          class="rounded-xl bg-[#ea4335] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#d93025] transition active:scale-98 disabled:opacity-50"
          onclick={handleConnectAccount}
          disabled={isConnecting || !newUsername.trim()}
        >
          {isConnecting ? 'Menghubungkan...' : 'Konfirmasi Koneksi'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Reusable Confirm Disconnect Modal (No Native Confirm!) -->
<ConfirmModal
  bind:isOpen={isDisconnectModalOpen}
  title={isLangEn ? 'Disconnect Social Account?' : 'Putus Koneksi Akun?'}
  message={isLangEn
    ? `Are you sure you want to disconnect @${accountToDisconnect?.username || 'account'}? Access token will be revoked and automated comment listening will stop.`
    : `Yakin ingin memutuskan koneksi akun @${accountToDisconnect?.username || 'akun'}? Token autentikasi akan dihapus dan sinkronisasi balasan komentar otomatis akan dihentikan.`}
  confirmText={isLangEn ? 'Disconnect Account' : 'Ya, Putuskan Koneksi'}
  cancelText={isLangEn ? 'Cancel' : 'Batal'}
  isDanger={true}
  onConfirm={handleConfirmDisconnect}
/>
