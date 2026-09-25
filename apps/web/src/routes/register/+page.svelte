<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Loader2, MessageSquareQuote } from 'lucide-svelte';
  import { api } from '$lib/api';
  import { pathFor, LOGIN_PATH } from '$lib/nav';
  import { session, signIn } from '$lib/session.svelte';
  import { toast } from '$lib/toast';

  let name = $state('');
  let brandName = $state('');
  let email = $state('');
  let password = $state('');
  let agree = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let trialDays = $state(14);

  onMount(async () => {
    if (session.isAuthenticated) return goto(pathFor('dashboard'), { replaceState: true });
    try {
      trialDays = (await api.getPricing()).trialDays;
    } catch {}
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    error = null;
    if (password.length < 10) return (error = 'Kata sandi minimal 10 karakter.');
    busy = true;
    try {
      const cleanEmail = email.trim().toLowerCase();
      await api.register({ name: name.trim(), email: cleanEmail, password, brandName: brandName.trim() });
      signIn(await api.signIn(cleanEmail, password));
      toast.success(`Selamat datang! Trial ${trialDays} hari sudah aktif.`, 'Akun dibuat');
      goto(pathFor('accounts'), { replaceState: true }); // first step: connect Instagram
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  let googleBusy = $state(false);
  async function google() {
    if (!agree) return (error = 'Centang persetujuan Syarat Layanan & Kebijakan Privasi dulu.');
    googleBusy = true;
    try {
      window.location.href = await api.googleSignInUrl(); // new Google users get their own trial workspace
    } catch (err) {
      error = (err as Error).message;
      googleBusy = false;
    }
  }

  const field =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
</script>

<svelte:head><title>Daftar · Replyra</title></svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
  <div class="w-full max-w-md">
    <div class="mb-6 flex items-center gap-2.5">
      <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><MessageSquareQuote class="h-5 w-5" /></span>
      <div>
        <p class="text-lg font-semibold text-slate-900 dark:text-white">Replyra</p>
        <p class="text-xs text-slate-500">Balas komentar Instagram dengan bantuan AI</p>
      </div>
    </div>

    <form onsubmit={submit} class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 class="text-xl font-semibold text-slate-900 dark:text-white">Buat akun</h1>
      <p class="mt-1 text-sm text-slate-500">Gratis {trialDays} hari · mode Shadow (AI membuat draf, tanpa mengirim) · 200 unit AI</p>

      <div class="mt-6 space-y-4">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Nama Anda</span>
          <input class={field} bind:value={name} required minlength="2" maxlength="80" autocomplete="name" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Nama brand / toko</span>
          <input class={field} bind:value={brandName} required minlength="2" maxlength="80" placeholder="mis. MauJahit.id" autocomplete="organization" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Email</span>
          <input class={field} type="email" bind:value={email} required autocomplete="email" inputmode="email" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Kata sandi</span>
          <input class={field} type="password" bind:value={password} required minlength="10" autocomplete="new-password" />
          <span class="mt-1 block text-xs text-slate-400">Minimal 10 karakter</span>
        </label>
        <label class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
          <input type="checkbox" bind:checked={agree} required class="mt-0.5 h-4 w-4 rounded" />
          <span>Saya setuju dengan <a href="/terms" class="text-brand-600 underline" target="_blank">Syarat Layanan</a> dan <a href="/privacy" class="text-brand-600 underline" target="_blank">Kebijakan Privasi</a>.</span>
        </label>
      </div>

      {#if error}
        <div class="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" role="alert">{error}</div>
      {/if}

      <button
        type="submit"
        disabled={busy || !agree}
        class="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if}
        Daftar & mulai trial
      </button>

      <button
        type="button"
        onclick={google}
        disabled={googleBusy}
        class="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {#if googleBusy}<Loader2 class="h-4 w-4 animate-spin" />{/if}
        Daftar dengan Google
      </button>

      <p class="mt-4 text-center text-sm text-slate-500">
        Sudah punya akun? <a href={LOGIN_PATH} class="font-medium text-brand-600 hover:underline">Masuk</a>
      </p>
    </form>
  </div>
</div>
