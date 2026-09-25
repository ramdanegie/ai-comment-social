<script lang="ts">
  import { onMount } from 'svelte';
  import { Loader2, Plus, Save, ShieldCheck } from 'lucide-svelte';
  import { api } from '../api';
  import type { BillingStatus, PaymentItem, Plan, TopupPackage } from '../types';
  import { toast } from '$lib/toast';
  import { formatDate, formatIdr, formatNumber } from '$lib/format';

  type Tab = 'overview' | 'plans' | 'topups' | 'trial' | 'tenants' | 'payments';
  type Overview = {
    workspaces: number;
    subscriptions: Array<{ status: string; expired: boolean; n: number }>;
    revenueThisMonthIdr: number;
    aiUnitsThisMonth: number;
    aiCostThisMonthUsd: number;
  };
  type Tenant = { id: string; name: string; slug: string; createdAt: string; owner: string | null; accounts: number; billing: BillingStatus | null };

  let tab = $state<Tab>('overview');
  let loading = $state(true);
  let saving = $state<string | null>(null);

  let overview = $state<Overview | null>(null);
  let plans = $state<Plan[]>([]);
  let topups = $state<TopupPackage[]>([]);
  let trialDays = $state(14);
  let tenants = $state<Tenant[]>([]);
  let payments = $state<PaymentItem[]>([]);

  const emptyPlan = (): Plan => ({ id: '', name: '', priceIdr: 0, monthlyAiUnits: 1000, maxSocialAccounts: 1, description: '', isPublic: true, sortOrder: 10 });
  const emptyTopup = (): TopupPackage => ({ id: '', name: '', aiUnits: 500, priceIdr: 100000, isActive: true, sortOrder: 10 });
  let newPlan = $state<Plan>(emptyPlan());
  let newTopup = $state<TopupPackage>(emptyTopup());

  // Manual subscription adjustment
  let editing = $state<Tenant | null>(null);
  let adjPlan = $state('');
  let adjEnd = $state('');
  let adjExtra = $state(0);

  async function loadAll() {
    loading = true;
    try {
      [overview, plans, topups, tenants, payments] = await Promise.all([
        api.admin.get<Overview>('/overview'),
        api.admin.get<Plan[]>('/plans'),
        api.admin.get<TopupPackage[]>('/topups'),
        api.admin.get<Tenant[]>('/workspaces'),
        api.admin.get<PaymentItem[]>('/payments')
      ]);
      trialDays = (await api.admin.get<{ trialDays: number }>('/settings')).trialDays;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      loading = false;
    }
  }
  onMount(loadAll);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    saving = key;
    try {
      await fn();
      toast.success(ok);
      await loadAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      saving = null;
    }
  }

  const planBody = (p: Plan) => ({
    name: p.name,
    priceIdr: Number(p.priceIdr),
    monthlyAiUnits: Number(p.monthlyAiUnits),
    maxSocialAccounts: Number(p.maxSocialAccounts),
    description: p.description || null,
    isPublic: p.isPublic,
    sortOrder: Number(p.sortOrder)
  });
  const topupBody = (t: TopupPackage) => ({
    name: t.name,
    aiUnits: Number(t.aiUnits),
    priceIdr: Number(t.priceIdr),
    isActive: t.isActive,
    sortOrder: Number(t.sortOrder)
  });

  function openAdjust(t: Tenant) {
    editing = t;
    adjPlan = t.billing?.subscription.planId ?? 'starter';
    adjEnd = (t.billing?.subscription.periodEnd ?? new Date().toISOString()).slice(0, 10);
    adjExtra = t.billing?.extraUnits ?? 0;
  }

  const tabs: Array<[Tab, string]> = [
    ['overview', 'Ringkasan'],
    ['plans', 'Paket & harga'],
    ['topups', 'Top-up'],
    ['trial', 'Trial'],
    ['tenants', 'Tenant'],
    ['payments', 'Pembayaran']
  ];
  const input =
    'h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:border-brand-500 focus:outline-none';
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><ShieldCheck class="h-5 w-5" /></span>
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Superadmin</h1>
      <p class="text-sm text-slate-500">Pengelola platform Replyra: harga, trial, tenant, dan pembayaran</p>
    </div>
  </div>

  <nav class="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800" aria-label="Bagian superadmin">
    {#each tabs as [id, label] (id)}
      <button
        type="button"
        onclick={() => (tab = id)}
        aria-current={tab === id ? 'page' : undefined}
        class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition {tab === id
          ? 'border-brand-600 text-brand-700 dark:text-brand-300'
          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
      >
        {label}
      </button>
    {/each}
  </nav>

  {#if loading && !overview}
    <div class="h-40 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
  {:else if tab === 'overview' && overview}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="soft-card p-4"><p class="text-xs text-slate-500">Workspace</p><p class="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(overview.workspaces)}</p></div>
      <div class="soft-card p-4"><p class="text-xs text-slate-500">Pendapatan bulan ini</p><p class="mt-1 text-2xl font-semibold tabular-nums">{formatIdr(overview.revenueThisMonthIdr)}</p></div>
      <div class="soft-card p-4"><p class="text-xs text-slate-500">Unit AI bulan ini</p><p class="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(overview.aiUnitsThisMonth)}</p></div>
      <div class="soft-card p-4"><p class="text-xs text-slate-500">Estimasi biaya AI</p><p class="mt-1 text-2xl font-semibold tabular-nums">${overview.aiCostThisMonthUsd.toFixed(2)}</p></div>
    </div>
    <div class="soft-card p-4 text-sm">
      <p class="mb-2 font-medium text-slate-900 dark:text-white">Status langganan</p>
      {#each overview.subscriptions as s}
        <p class="text-slate-600 dark:text-slate-300">{s.status}{s.expired ? ' (berakhir)' : ''}: <strong class="tabular-nums">{s.n}</strong></p>
      {:else}
        <p class="text-slate-400">Belum ada.</p>
      {/each}
    </div>
  {:else if tab === 'plans'}
    <div class="soft-card overflow-x-auto p-0">
      <table class="w-full min-w-[900px] text-sm">
        <thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/60">
          <tr>
            <th class="px-3 py-2">ID</th><th class="px-3 py-2">Nama</th><th class="px-3 py-2">Harga / bln (Rp)</th><th class="px-3 py-2">Unit AI / bln</th>
            <th class="px-3 py-2">Maks akun</th><th class="px-3 py-2">Label</th><th class="px-3 py-2">Dijual</th><th class="px-3 py-2">Urut</th><th></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          {#each plans as p (p.id)}
            <tr>
              <td class="px-3 py-2 font-mono text-xs">{p.id}</td>
              <td class="px-3 py-2"><input class={input} bind:value={p.name} /></td>
              <td class="px-3 py-2"><input class={input} type="number" min="0" bind:value={p.priceIdr} disabled={p.id === 'trial'} /></td>
              <td class="px-3 py-2"><input class={input} type="number" min="0" bind:value={p.monthlyAiUnits} /></td>
              <td class="px-3 py-2"><input class={input} type="number" min="1" bind:value={p.maxSocialAccounts} /></td>
              <td class="px-3 py-2"><input class={input} bind:value={p.description} placeholder="mis. Paling populer" /></td>
              <td class="px-3 py-2 text-center"><input type="checkbox" bind:checked={p.isPublic} disabled={p.id === 'trial'} class="h-4 w-4" /></td>
              <td class="px-3 py-2 w-20"><input class={input} type="number" min="0" bind:value={p.sortOrder} /></td>
              <td class="px-3 py-2">
                <button type="button" class="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50" disabled={!!saving}
                  onclick={() => run(`plan-${p.id}`, () => api.admin.send('PUT', `/plans/${p.id}`, planBody(p)), `Paket ${p.name} disimpan`)}>
                  {#if saving === `plan-${p.id}`}<Loader2 class="h-3.5 w-3.5 animate-spin" />{:else}<Save class="h-3.5 w-3.5" />{/if}Simpan
                </button>
              </td>
            </tr>
          {/each}
          <tr class="bg-slate-50/60 dark:bg-slate-900/40">
            <td class="px-3 py-2"><input class={input} bind:value={newPlan.id} placeholder="id-paket" /></td>
            <td class="px-3 py-2"><input class={input} bind:value={newPlan.name} placeholder="Nama" /></td>
            <td class="px-3 py-2"><input class={input} type="number" min="0" bind:value={newPlan.priceIdr} /></td>
            <td class="px-3 py-2"><input class={input} type="number" min="0" bind:value={newPlan.monthlyAiUnits} /></td>
            <td class="px-3 py-2"><input class={input} type="number" min="1" bind:value={newPlan.maxSocialAccounts} /></td>
            <td class="px-3 py-2"><input class={input} bind:value={newPlan.description} /></td>
            <td class="px-3 py-2 text-center"><input type="checkbox" bind:checked={newPlan.isPublic} class="h-4 w-4" /></td>
            <td class="px-3 py-2"><input class={input} type="number" min="0" bind:value={newPlan.sortOrder} /></td>
            <td class="px-3 py-2">
              <button type="button" class="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-white disabled:opacity-50 dark:border-slate-600" disabled={!!saving || !newPlan.id || !newPlan.name}
                onclick={() => run('plan-new', async () => { await api.admin.send('POST', '/plans', { id: newPlan.id.trim(), ...planBody(newPlan) }); newPlan = emptyPlan(); }, 'Paket baru ditambahkan')}>
                <Plus class="h-3.5 w-3.5" />Tambah
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-slate-500">Harga berlaku untuk transaksi berikutnya; langganan yang sudah dibayar tidak berubah. Paket <code>trial</code> dipakai otomatis untuk pendaftar baru dan tidak bisa dijual.</p>
  {:else if tab === 'topups'}
    <div class="soft-card overflow-x-auto p-0">
      <table class="w-full min-w-[720px] text-sm">
        <thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/60">
          <tr><th class="px-3 py-2">ID</th><th class="px-3 py-2">Nama</th><th class="px-3 py-2">Unit AI</th><th class="px-3 py-2">Harga (Rp)</th><th class="px-3 py-2">Aktif</th><th class="px-3 py-2">Urut</th><th></th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          {#each topups as tp (tp.id)}
            <tr>
              <td class="px-3 py-2 font-mono text-xs">{tp.id}</td>
              <td class="px-3 py-2"><input class={input} bind:value={tp.name} /></td>
              <td class="px-3 py-2"><input class={input} type="number" min="1" bind:value={tp.aiUnits} /></td>
              <td class="px-3 py-2"><input class={input} type="number" min="1000" bind:value={tp.priceIdr} /></td>
              <td class="px-3 py-2 text-center"><input type="checkbox" bind:checked={tp.isActive} class="h-4 w-4" /></td>
              <td class="px-3 py-2 w-20"><input class={input} type="number" min="0" bind:value={tp.sortOrder} /></td>
              <td class="px-3 py-2">
                <button type="button" class="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50" disabled={!!saving}
                  onclick={() => run(`tp-${tp.id}`, () => api.admin.send('PUT', `/topups/${tp.id}`, topupBody(tp)), 'Paket top-up disimpan')}>
                  <Save class="h-3.5 w-3.5" />Simpan
                </button>
              </td>
            </tr>
          {/each}
          <tr class="bg-slate-50/60 dark:bg-slate-900/40">
            <td class="px-3 py-2"><input class={input} bind:value={newTopup.id} placeholder="topup-1000" /></td>
            <td class="px-3 py-2"><input class={input} bind:value={newTopup.name} placeholder="1.000 unit AI" /></td>
            <td class="px-3 py-2"><input class={input} type="number" min="1" bind:value={newTopup.aiUnits} /></td>
            <td class="px-3 py-2"><input class={input} type="number" min="1000" bind:value={newTopup.priceIdr} /></td>
            <td class="px-3 py-2 text-center"><input type="checkbox" bind:checked={newTopup.isActive} class="h-4 w-4" /></td>
            <td class="px-3 py-2"><input class={input} type="number" min="0" bind:value={newTopup.sortOrder} /></td>
            <td class="px-3 py-2">
              <button type="button" class="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-600" disabled={!!saving || !newTopup.id || !newTopup.name}
                onclick={() => run('tp-new', async () => { await api.admin.send('POST', '/topups', { id: newTopup.id.trim(), ...topupBody(newTopup) }); newTopup = emptyTopup(); }, 'Paket top-up ditambahkan')}>
                <Plus class="h-3.5 w-3.5" />Tambah
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  {:else if tab === 'trial'}
    <div class="soft-card max-w-md space-y-4 p-5">
      <label class="block text-sm">
        <span class="mb-1.5 block font-medium">Lama trial (hari)</span>
        <input class={input} type="number" min="1" max="90" bind:value={trialDays} />
      </label>
      <p class="text-xs text-slate-500">Kuota trial diatur di tab <em>Paket & harga</em> (baris <code>trial</code>, kolom Unit AI). Berlaku untuk pendaftar berikutnya.</p>
      <button type="button" class="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!!saving}
        onclick={() => run('trial', () => api.admin.send('PUT', '/settings', { trialDays: Number(trialDays) }), 'Pengaturan trial disimpan')}>
        <Save class="h-4 w-4" />Simpan
      </button>
    </div>
  {:else if tab === 'tenants'}
    <div class="soft-card overflow-x-auto p-0">
      <table class="w-full min-w-[860px] text-sm">
        <thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/60">
          <tr><th class="px-3 py-2">Workspace</th><th class="px-3 py-2">Owner</th><th class="px-3 py-2">Paket</th><th class="px-3 py-2">Berakhir</th><th class="px-3 py-2 text-right">Unit AI</th><th class="px-3 py-2 text-right">Akun</th><th></th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          {#each tenants as t (t.id)}
            <tr>
              <td class="px-3 py-2"><p class="font-medium text-slate-900 dark:text-white">{t.name}</p><p class="font-mono text-[11px] text-slate-400">{t.slug}</p></td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{t.owner ?? '-'}</td>
              <td class="px-3 py-2">
                {t.billing?.plan?.name ?? '-'}
                {#if t.billing?.expired}<span class="ml-1 rounded-full bg-rose-500/10 px-1.5 text-[11px] text-rose-700">berakhir</span>{:else if t.billing?.isTrial}<span class="ml-1 rounded-full bg-sky-500/10 px-1.5 text-[11px] text-sky-700">trial</span>{/if}
              </td>
              <td class="px-3 py-2 whitespace-nowrap">{t.billing ? formatDate(t.billing.subscription.periodEnd) : '-'}</td>
              <td class="px-3 py-2 text-right tabular-nums">{t.billing ? `${formatNumber(t.billing.usedUnits)} / ${formatNumber(t.billing.totalUnits)}` : '-'}</td>
              <td class="px-3 py-2 text-right tabular-nums">{t.accounts}</td>
              <td class="px-3 py-2 text-right"><button type="button" class="text-xs font-medium text-brand-600 hover:underline" onclick={() => openAdjust(t)}>Atur langganan</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if tab === 'payments'}
    <div class="soft-card overflow-x-auto p-0">
      <table class="w-full min-w-[760px] text-sm">
        <thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/60">
          <tr><th class="px-3 py-2">Tanggal</th><th class="px-3 py-2">Workspace</th><th class="px-3 py-2">Item</th><th class="px-3 py-2 text-right">Jumlah</th><th class="px-3 py-2">Status</th><th class="px-3 py-2">Metode</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          {#each payments as p (p.orderId)}
            <tr>
              <td class="px-3 py-2 whitespace-nowrap">{formatDate(p.createdAt)}</td>
              <td class="px-3 py-2">{p.workspace}</td>
              <td class="px-3 py-2">{p.kind === 'top_up' ? `Top-up ${formatNumber(p.aiUnits ?? 0)}` : `Paket ${p.planId}`}<span class="block font-mono text-[11px] text-slate-400">{p.orderId}</span></td>
              <td class="px-3 py-2 text-right tabular-nums">{formatIdr(p.amountIdr)}</td>
              <td class="px-3 py-2">{p.status}</td>
              <td class="px-3 py-2">{p.paymentType ?? '-'}</td>
            </tr>
          {:else}
            <tr><td colspan="6" class="px-3 py-8 text-center text-slate-400">Belum ada pembayaran.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if editing}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
    <div class="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="adj-title">
      <h2 id="adj-title" class="text-base font-semibold">Atur langganan — {editing.name}</h2>
      <p class="text-xs text-slate-500">Untuk kompensasi, pembayaran manual, atau perpanjangan. Tercatat di audit log.</p>
      <label class="block text-sm"><span class="mb-1 block font-medium">Paket</span>
        <select class={input} bind:value={adjPlan}>{#each plans as p (p.id)}<option value={p.id}>{p.name} ({p.id})</option>{/each}</select>
      </label>
      <label class="block text-sm"><span class="mb-1 block font-medium">Berlaku sampai</span><input class={input} type="date" bind:value={adjEnd} /></label>
      <label class="block text-sm"><span class="mb-1 block font-medium">Unit AI tambahan (top-up)</span><input class={input} type="number" min="0" bind:value={adjExtra} /></label>
      <div class="flex justify-end gap-2">
        <button type="button" class="h-9 rounded-lg px-3 text-sm" onclick={() => (editing = null)}>Batal</button>
        <button type="button" class="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!!saving}
          onclick={() => run('adj', async () => {
            await api.admin.send('PUT', `/workspaces/${editing!.id}/subscription`, { planId: adjPlan, periodEnd: new Date(`${adjEnd}T23:59:59+07:00`).toISOString(), extraAiUnits: Number(adjExtra) });
            editing = null;
          }, 'Langganan diperbarui')}>
          <Save class="h-4 w-4" />Simpan
        </button>
      </div>
    </div>
  </div>
{/if}
