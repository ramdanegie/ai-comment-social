<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { AlertTriangle, Check, CreditCard, ExternalLink, Loader2, RefreshCw, Sparkles, Zap } from 'lucide-svelte';
  import { api } from '../api';
  import type { BillingOverview, Plan, TopupPackage } from '../types';
  import { toast } from '$lib/toast';
  import { formatDate, formatIdr, formatNumber } from '$lib/format';

  let { workspaceSlug = '', isLangEn = false }: { workspaceSlug?: string; isLangEn?: boolean } = $props();

  let data = $state<BillingOverview | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let busyId = $state<string | null>(null);

  let st = $derived(data?.status ?? null);
  let usedPct = $derived(st && st.totalUnits > 0 ? Math.min(100, Math.round((st.usedUnits / st.totalUnits) * 100)) : 0);
  let canTopup = $derived(!!st && !st.isTrial && !st.expired);

  async function load() {
    try {
      data = await api.getBilling(workspaceSlug);
      error = null;
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    // Back from Midtrans: /billing?order_id=…&transaction_status=… → confirm with the server (never trust the URL).
    const orderId = page.url.searchParams.get('order_id');
    if (orderId) {
      history.replaceState(history.state, '', page.url.pathname);
      const res = await api.syncPayment(workspaceSlug, orderId);
      if (res.status === 'settlement') toast.success(isLangEn ? 'Payment received. Thank you!' : 'Pembayaran diterima. Terima kasih!');
      else if (res.status === 'pending') toast.info(isLangEn ? 'Waiting for payment…' : 'Menunggu pembayaran diselesaikan…');
      else if (res.status) toast.warning(`Status: ${res.status}`);
    }
    await load();
  });

  async function checkout(req: { kind: 'subscription'; planId: string } | { kind: 'top_up'; packageId: string }) {
    busyId = req.kind === 'subscription' ? req.planId : req.packageId;
    try {
      const { redirectUrl } = await api.checkout(workspaceSlug, req);
      window.location.href = redirectUrl; // Midtrans Snap payment page
    } catch (err) {
      toast.error((err as Error).message, isLangEn ? 'Checkout failed' : 'Gagal membuat pembayaran');
      busyId = null;
    }
  }

  async function refresh(orderId: string) {
    busyId = orderId;
    const res = await api.syncPayment(workspaceSlug, orderId);
    toast.info(`Status: ${res.status ?? '-'}`);
    await load();
    busyId = null;
  }

  const planLabel = (p: Plan) => `${formatIdr(p.priceIdr)} / ${isLangEn ? 'month' : 'bulan'}`;
  const statusStyle: Record<string, string> = {
    settlement: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    pending: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    expire: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    cancel: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    deny: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    failure: 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
  };
  const statusText: Record<string, string> = {
    settlement: 'Lunas',
    pending: 'Menunggu',
    expire: 'Kedaluwarsa',
    cancel: 'Dibatalkan',
    deny: 'Ditolak',
    failure: 'Gagal',
    refund: 'Refund'
  };
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
      {isLangEn ? 'Plan & AI quota' : 'Paket & Kuota AI'}
    </h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      {isLangEn ? 'Subscription, AI units, top-ups and payments' : 'Langganan, unit AI, top-up, dan riwayat pembayaran'}
    </p>
  </div>

  {#if loading}
    <div class="h-40 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
  {:else if error}
    <div class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>
  {:else if data}
    {#if !data.paymentsEnabled}
      <div class="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
        {isLangEn ? 'Online payment is not configured yet.' : 'Pembayaran online belum diaktifkan. Hubungi pengelola platform.'}
      </div>
    {/if}

    <!-- Current plan -->
    {#if st}
      <section class="soft-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-slate-500">{isLangEn ? 'Current plan' : 'Paket saat ini'}</p>
            <p class="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              {st.plan?.name ?? st.subscription.planId}
              {#if st.expired}
                <span class="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">{isLangEn ? 'Expired' : 'Berakhir'}</span>
              {:else if st.isTrial}
                <span class="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">Trial</span>
              {:else}
                <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{isLangEn ? 'Active' : 'Aktif'}</span>
              {/if}
            </p>
            <p class="mt-1 text-sm text-slate-500">
              {st.expired ? (isLangEn ? 'Ended' : 'Berakhir') : isLangEn ? 'Until' : 'Berlaku sampai'}
              {formatDate(st.subscription.periodEnd, isLangEn)}
              · {isLangEn ? 'max' : 'maks.'} {st.plan?.maxSocialAccounts ?? '-'} {isLangEn ? 'accounts' : 'akun sosial'}
            </p>
          </div>
          <div class="min-w-56 flex-1 sm:max-w-sm">
            <div class="flex justify-between text-xs text-slate-500">
              <span>{isLangEn ? 'AI units used' : 'Unit AI terpakai'}</span>
              <span class="tabular-nums">{formatNumber(st.usedUnits)} / {formatNumber(st.totalUnits)}</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div class="h-full rounded-full {usedPct >= 90 ? 'bg-rose-500' : usedPct >= 80 ? 'bg-amber-500' : 'bg-brand-500'}" style="width: {usedPct}%"></div>
            </div>
            <p class="mt-1.5 text-xs text-slate-500">
              {isLangEn ? 'Remaining' : 'Sisa'} <strong class="tabular-nums text-slate-800 dark:text-slate-200">{formatNumber(st.remainingUnits)}</strong>
              {#if st.extraUnits > 0}· {isLangEn ? 'incl.' : 'termasuk'} {formatNumber(st.extraUnits)} top-up{/if}
            </p>
          </div>
        </div>

        {#if st.isTrial || st.expired}
          <div class="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <Sparkles class="mt-0.5 h-4 w-4 shrink-0" />
            {st.expired
              ? isLangEn ? 'Your plan has ended: AI and publishing are paused. Choose a plan to continue.' : 'Paket berakhir: AI dan pengiriman balasan dihentikan. Pilih paket untuk melanjutkan.'
              : isLangEn ? 'Trial runs in Shadow mode: AI classifies and drafts, nothing is posted. Upgrade to reply from Replyra.' : 'Trial berjalan dalam mode Shadow: AI mengklasifikasi & membuat draf tanpa mengirim. Upgrade untuk membalas dari Replyra.'}
          </div>
        {/if}
      </section>
    {/if}

    <!-- Plans -->
    <section>
      <h2 class="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{isLangEn ? 'Plans' : 'Pilih paket'}</h2>
      <div class="grid gap-4 md:grid-cols-3">
        {#each data.pricing.plans as p (p.id)}
          {@const current = st?.plan?.id === p.id && !st?.isTrial}
          <div class="soft-card flex flex-col p-5 {current ? 'ring-2 ring-brand-500' : ''}">
            <div class="flex items-center justify-between">
              <p class="font-semibold text-slate-900 dark:text-white">{p.name}</p>
              {#if p.description}<span class="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:text-brand-300">{p.description}</span>{/if}
            </div>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{formatIdr(p.priceIdr)}</p>
            <p class="text-xs text-slate-500">{isLangEn ? 'per month' : 'per bulan'}</p>
            <ul class="mt-4 flex-1 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <li class="flex gap-2"><Check class="h-4 w-4 shrink-0 text-emerald-500" />{formatNumber(p.monthlyAiUnits)} {isLangEn ? 'AI units / month' : 'unit AI / bulan'}</li>
              <li class="flex gap-2"><Check class="h-4 w-4 shrink-0 text-emerald-500" />{p.maxSocialAccounts} {isLangEn ? 'social accounts' : 'akun sosial'}</li>
              <li class="flex gap-2"><Check class="h-4 w-4 shrink-0 text-emerald-500" />{isLangEn ? 'Assisted & Auto reply' : 'Mode Assisted & Auto'}</li>
            </ul>
            <button
              type="button"
              disabled={!data.paymentsEnabled || !!busyId}
              onclick={() => checkout({ kind: 'subscription', planId: p.id })}
              class="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 {current
                ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                : 'bg-brand-600 text-white hover:bg-brand-700'}"
            >
              {#if busyId === p.id}<Loader2 class="h-4 w-4 animate-spin" />{:else}<CreditCard class="h-4 w-4" />{/if}
              {current ? (isLangEn ? 'Renew 1 month' : 'Perpanjang 1 bulan') : isLangEn ? `Choose — ${planLabel(p)}` : 'Pilih paket'}
            </button>
          </div>
        {/each}
      </div>
    </section>

    <!-- Top-up -->
    <section class="soft-card p-5">
      <div class="flex items-center gap-2">
        <Zap class="h-4 w-4 text-brand-500" />
        <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{isLangEn ? 'Top up AI units' : 'Isi ulang unit AI'}</h2>
      </div>
      <p class="mt-1 text-xs text-slate-500">
        {canTopup
          ? isLangEn ? 'Extra units stay available while your plan is active.' : 'Unit tambahan berlaku selama paket aktif.'
          : isLangEn ? 'Available on an active paid plan.' : 'Tersedia setelah berlangganan paket berbayar.'}
      </p>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {#each data.pricing.topups as tp (tp.id)}
          <button
            type="button"
            disabled={!canTopup || !data.paymentsEnabled || !!busyId}
            onclick={() => checkout({ kind: 'top_up', packageId: tp.id })}
            class="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
          >
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{formatNumber(tp.aiUnits)} {isLangEn ? 'units' : 'unit'}</p>
            <p class="mt-1 text-sm tabular-nums text-brand-600 dark:text-brand-400">
              {#if busyId === tp.id}<Loader2 class="inline h-3.5 w-3.5 animate-spin" />{/if}
              {formatIdr(tp.priceIdr)}
            </p>
          </button>
        {/each}
      </div>
    </section>

    <!-- Payments -->
    <section class="soft-card overflow-hidden p-0">
      <h2 class="px-5 pt-5 text-sm font-semibold text-slate-900 dark:text-white">{isLangEn ? 'Payment history' : 'Riwayat pembayaran'}</h2>
      {#if data.payments.length === 0}
        <p class="px-5 py-8 text-center text-sm text-slate-400">{isLangEn ? 'No payments yet.' : 'Belum ada pembayaran.'}</p>
      {:else}
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/60">
              <tr>
                <th class="px-5 py-2 font-medium">{isLangEn ? 'Date' : 'Tanggal'}</th>
                <th class="px-5 py-2 font-medium">Item</th>
                <th class="px-5 py-2 text-right font-medium">{isLangEn ? 'Amount' : 'Jumlah'}</th>
                <th class="px-5 py-2 font-medium">Status</th>
                <th class="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              {#each data.payments as p (p.orderId)}
                <tr>
                  <td class="px-5 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(p.createdAt, isLangEn)}</td>
                  <td class="px-5 py-2.5 text-slate-800 dark:text-slate-200">
                    {p.kind === 'top_up' ? `Top-up ${formatNumber(p.aiUnits ?? 0)} unit` : `Paket ${p.planId}`}
                    <span class="block font-mono text-[11px] text-slate-400">{p.orderId}</span>
                  </td>
                  <td class="px-5 py-2.5 text-right tabular-nums">{formatIdr(p.amountIdr)}</td>
                  <td class="px-5 py-2.5">
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium {statusStyle[p.status] ?? 'bg-slate-500/10 text-slate-600'}">{statusText[p.status] ?? p.status}</span>
                  </td>
                  <td class="px-5 py-2.5 text-right whitespace-nowrap">
                    {#if p.status === 'pending'}
                      {#if p.redirectUrl}
                        <a href={p.redirectUrl} class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                          {isLangEn ? 'Pay' : 'Bayar'} <ExternalLink class="h-3 w-3" />
                        </a>
                      {/if}
                      <button type="button" class="ml-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" onclick={() => refresh(p.orderId)} disabled={!!busyId}>
                        <RefreshCw class="h-3 w-3 {busyId === p.orderId ? 'animate-spin' : ''}" />{isLangEn ? 'Check' : 'Cek status'}
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>
