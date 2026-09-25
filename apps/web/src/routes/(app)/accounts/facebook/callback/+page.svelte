<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { CheckCircle2, Loader2, XCircle } from 'lucide-svelte';
  import FacebookIcon from '$lib/components/icons/FacebookIcon.svelte';
  import { api } from '$lib/api';
  import { toast } from '$lib/toast';
  import { pathFor } from '$lib/nav';
  import { session } from '$lib/session.svelte';

  type PageChoice = { id: string; name: string; pictureUrl: string | null; instagramUsername: string | null };

  let status = $state<'working' | 'choose' | 'connecting' | 'done' | 'error'>('working');
  let message = $state('');
  let ws = $state('');
  let ticket = '';
  let pages = $state<PageChoice[]>([]);
  let selected = $state<string[]>([]);

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
    // The single-use code shouldn't stay in the address bar/history.
    history.replaceState(history.state, '', page.url.pathname);

    if (q.get('error') || !code || !state) {
      status = 'error';
      message =
        q.get('error_reason') === 'user_denied'
          ? 'Izin dibatalkan di Facebook.'
          : (q.get('error_description') ?? 'Facebook tidak mengirim kode otorisasi.');
      return;
    }

    try {
      ws = workspaceFromState(state);
      const res = await api.exchangeFacebookCode(ws, code, state);
      ticket = res.ticket;
      pages = res.pages;
      selected = res.pages.length === 1 ? [res.pages[0].id] : [];
      status = 'choose';
    } catch (err) {
      status = 'error';
      message = (err as Error).message;
    }
  });

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  async function connect() {
    status = 'connecting';
    try {
      const accounts = await api.connectFacebookPages(ws, ticket, selected);
      status = 'done';
      message = `${accounts.map((a) => a.username).join(', ')} terhubung. Komentar sedang ditarik…`;
      toast.success(message, 'Facebook terhubung');
      setTimeout(() => goto(pathFor('accounts'), { replaceState: true }), 1200);
    } catch (err) {
      status = 'choose';
      toast.error((err as Error).message, 'Gagal');
    }
  }
</script>

<svelte:head><title>Menghubungkan Facebook · Replyra</title></svelte:head>

<div class="mx-auto mt-16 max-w-md">
  <div class="soft-card p-8">
    {#if status === 'working'}
      <div class="flex flex-col items-center text-center">
        <Loader2 class="h-10 w-10 animate-spin text-brand-500" />
        <h1 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Menghubungkan Facebook…</h1>
        <p class="mt-1 text-sm text-slate-500">Membaca daftar Page yang Anda kelola.</p>
      </div>
    {:else if status === 'choose' || status === 'connecting'}
      <div class="flex items-center gap-3">
        <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1877F2] dark:bg-blue-950/40">
          <FacebookIcon class="h-5 w-5" />
        </span>
        <div>
          <h1 class="text-base font-semibold text-slate-900 dark:text-white">Pilih Facebook Page</h1>
          <p class="text-xs text-slate-500">Komentar di Page terpilih akan dimoderasi (mulai mode Shadow).</p>
        </div>
      </div>

      <ul class="mt-5 space-y-2">
        {#each pages as p (p.id)}
          <li>
            <label
              class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition {selected.includes(p.id)
                ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-500/10'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'}"
            >
              <input type="checkbox" class="h-4 w-4 rounded" checked={selected.includes(p.id)} onchange={() => toggle(p.id)} />
              {#if p.pictureUrl}
                <img src={p.pictureUrl} alt="" class="h-9 w-9 rounded-lg object-cover" />
              {:else}
                <span class="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800"></span>
              {/if}
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-slate-900 dark:text-white">{p.name}</span>
                {#if p.instagramUsername}
                  <span class="block truncate text-xs text-slate-500">IG terhubung: @{p.instagramUsername}</span>
                {/if}
              </span>
            </label>
          </li>
        {/each}
      </ul>

      <div class="mt-6 flex items-center justify-between gap-3">
        <a href={pathFor('accounts')} class="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Batal</a>
        <button
          type="button"
          onclick={connect}
          disabled={!selected.length || status === 'connecting'}
          class="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {#if status === 'connecting'}<Loader2 class="h-4 w-4 animate-spin" />{/if}
          Hubungkan {selected.length || ''} Page
        </button>
      </div>
    {:else if status === 'done'}
      <div class="flex flex-col items-center text-center">
        <CheckCircle2 class="h-10 w-10 text-emerald-500" />
        <h1 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Berhasil</h1>
        <p class="mt-1 text-sm text-slate-500">{message}</p>
      </div>
    {:else}
      <div class="flex flex-col items-center text-center">
        <XCircle class="h-10 w-10 text-rose-500" />
        <h1 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Gagal menghubungkan</h1>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <a
          href={pathFor('accounts')}
          class="mt-6 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Kembali ke Akun Terhubung
        </a>
      </div>
    {/if}
  </div>
</div>
