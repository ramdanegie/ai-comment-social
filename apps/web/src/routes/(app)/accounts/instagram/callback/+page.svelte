<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { CheckCircle2, Loader2, XCircle } from 'lucide-svelte';
  import { api } from '$lib/api';
  import { toast } from '$lib/toast';
  import { pathFor } from '$lib/nav';
  import { session } from '$lib/session.svelte';

  let status = $state<'working' | 'done' | 'error'>('working');
  let message = $state('');
  /** Full redirect URL, kept on failure so it can be pasted into another Replyra instance (e.g. localhost). */
  let redirectUrl = $state('');
  let copied = $state(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(redirectUrl);
    copied = true;
  }

  /** Workspace slug is inside the signed state payload (verified again by the API). */
  function workspaceFromState(state: string | null): string {
    try {
      return JSON.parse(atob(state!.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).ws || session.workspace;
    } catch {
      return session.workspace;
    }
  }

  onMount(async () => {
    const q = page.url.searchParams;
    const code = q.get('code');
    const state = q.get('state');

    if (q.get('error_reason') || !code) {
      status = 'error';
      message =
        q.get('error_reason') === 'user_denied'
          ? 'Izin dibatalkan di Instagram.'
          : (q.get('error_description') ?? 'Instagram tidak mengirim kode otorisasi.');
      return;
    }

    redirectUrl = page.url.href;

    try {
      const ws = workspaceFromState(state);
      const account = await api.connectInstagram(ws, code, state ?? undefined);
      // Success: drop the single-use code from the address bar/history.
      history.replaceState(history.state, '', page.url.pathname);
      status = 'done';
      message = `@${account.username} terhubung. Komentar sedang ditarik…`;
      toast.success(message, 'Instagram terhubung');
      setTimeout(() => goto(pathFor('accounts'), { replaceState: true }), 1200);
    } catch (err) {
      status = 'error';
      message = (err as Error).message;
    }
  });
</script>

<svelte:head><title>Menghubungkan Instagram · Replyra</title></svelte:head>

<div class="mx-auto mt-16 max-w-md">
  <div class="soft-card flex flex-col items-center p-8 text-center">
    {#if status === 'working'}
      <Loader2 class="h-10 w-10 animate-spin text-brand-500" />
      <h1 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Menghubungkan Instagram…</h1>
      <p class="mt-1 text-sm text-slate-500">Menukar kode otorisasi dan membaca profil akun.</p>
    {:else if status === 'done'}
      <CheckCircle2 class="h-10 w-10 text-emerald-500" />
      <h1 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Berhasil</h1>
      <p class="mt-1 text-sm text-slate-500">{message}</p>
    {:else}
      <XCircle class="h-10 w-10 text-rose-500" />
      <h1 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Gagal menghubungkan</h1>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      {#if redirectUrl}
        <div class="mt-5 w-full space-y-2 text-left">
          <p class="text-xs text-slate-500">
            Menghubungkan dari Replyra lain (mis. localhost)? Salin URL ini lalu tempel di
            <strong>Akun Terhubung → Hubungkan Instagram</strong> (berlaku 1 jam, sekali pakai).
          </p>
          <div class="flex gap-2">
            <input
              readonly
              value={redirectUrl}
              class="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
            <button
              type="button"
              onclick={copyUrl}
              class="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              {copied ? 'Tersalin ✓' : 'Salin'}
            </button>
          </div>
        </div>
      {/if}
      <a
        href={pathFor('accounts')}
        class="mt-6 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Kembali ke Akun Terhubung
      </a>
    {/if}
  </div>
</div>
