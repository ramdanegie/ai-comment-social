<script lang="ts">
  import { onMount } from 'svelte';
  import {
    CreditCard,
    Zap,
    Check,
    AlertTriangle,
    QrCode,
    Sparkles,
    ShieldCheck,
    X,
    FileText
  } from 'lucide-svelte';
  import { api } from '../api';
  import type { PaymentItem } from '../types';
  import { toast } from '$lib/toast';

  let {
    workspaceSlug = '',
    isLangEn = false
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
  } = $props();

  let billingData: any = $state(null);
  let loading: boolean = $state(true);
  let showTopUpModal: boolean = $state(false);
  let selectedUnits: number = $state(500);
  let isCheckingOut: boolean = $state(false);
  let snapModalOpen: boolean = $state(false);
  let activeSnapToken: string = $state('');
  let activeAmount: number = $state(0);

  async function loadBilling() {
    loading = true;
    try {
      billingData = await api.getBilling(workspaceSlug);
    } finally {
      loading = false;
    }
  }

  onMount(loadBilling);

  async function handleTopUpCheckout() {
    isCheckingOut = true;
    try {
      const res = await api.checkout(workspaceSlug, {
        kind: 'top_up',
        aiUnits: selectedUnits
      });
      activeSnapToken = res.snapToken;
      activeAmount = res.amount;
      showTopUpModal = false;
      snapModalOpen = true;
    } finally {
      isCheckingOut = false;
    }
  }

  function handlePaymentSuccess() {
    if (billingData) {
      billingData.totalUnits += selectedUnits;
      billingData.paymentHistory.unshift({
        id: `pay_${Date.now()}`,
        orderId: `INV-${Date.now()}`,
        kind: 'top_up',
        amountIdr: activeAmount,
        status: 'settlement',
        paymentType: 'qris',
        createdAt: new Date().toISOString()
      });
    }
    snapModalOpen = false;
    toast.success(
      isLangEn
        ? 'Midtrans payment verified! AI unit quota has been added.'
        : 'Pembayaran Midtrans berhasil diverifikasi! Kuota AI unit telah ditambahkan.',
      isLangEn ? 'Payment Success' : 'Pembayaran Berhasil'
    );
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {isLangEn ? 'Subscription & AI Quota' : 'Langganan & Kuota AI'}
      </h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Manage your active plan, AI comments metering, and Midtrans top-up'
          : 'Monitoring penggunaan AI units (1 komentar = 1 unit) & pembayaran Midtrans'}
      </p>
    </div>

    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-600 active:scale-95"
      onclick={() => (showTopUpModal = true)}
    >
      <Zap class="h-4 w-4" />
      <span>Top-Up AI Units</span>
    </button>
  </div>

  <!-- AI Metering Progress Banner -->
  {#if billingData}
    <div class="soft-card p-5.5 space-y-4">
      <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <span class="text-xs font-semibold text-slate-500">Pemakaian AI Comments Bulan Ini</span>
          <div class="flex items-baseline gap-2 mt-1">
            <span class="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {billingData.usedUnits.toLocaleString('id-ID')}
            </span>
            <span class="text-sm font-semibold text-slate-400 font-mono">
              / {billingData.totalUnits.toLocaleString('id-ID')} units
            </span>
          </div>
        </div>

        <div class="text-right">
          <span class="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-3 py-1 text-xs font-bold">
            {billingData.percentUsed}% Terpakai
          </span>
          <p class="mt-1 text-[11px] text-slate-400">Reset periode: 27 hari lagi</p>
        </div>
      </div>

      <!-- Meter bar -->
      <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          class="h-full bg-brand-500 transition-all duration-500 rounded-full"
          style="width: {billingData.percentUsed}%"
        ></div>
      </div>

      <!-- Rule fallback notice -->
      <div class="flex items-center gap-2 rounded-xl bg-slate-50/70 p-3 text-xs text-slate-600 dark:bg-slate-850/60 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60">
        <ShieldCheck class="h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          <strong>Proteksi Kuota Habis:</strong> Jika kuota habis, sistem otomatis beralih ke <em>Rule Prefilter Only</em>. Komentar tetap masuk ke antrean review tanpa ada yang hilang atau terlewat.
        </span>
      </div>
    </div>
  {/if}

  <!-- Pricing Plans Grid -->
  <div class="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
    <!-- Starter -->
    <div class="soft-card soft-card-hover p-5.5">
      <h3 class="text-base font-bold text-slate-900 dark:text-white">Starter</h3>
      <p class="mt-1 text-xs text-slate-500">Untuk UMKM rintisan & olshop kecil</p>
      <div class="mt-4">
        <span class="text-2xl font-bold font-mono">Rp 299.000</span>
        <span class="text-xs text-slate-400">/ bulan</span>
      </div>
      <ul class="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> 1.000 AI Units / bulan</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Maks. 2 Akun Sosial (IG/FB)</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Shadow & Assisted Mode</li>
      </ul>
      <button type="button" class="mt-6 w-full rounded-xl border border-slate-200/80 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 shadow-2xs">
        Pilih Paket
      </button>
    </div>

    <!-- Growth (Active) -->
    <div class="relative rounded-2xl border-2 border-brand-500/80 bg-white p-5.5 shadow-[0_4px_24px_rgba(79,70,229,0.12)] dark:bg-slate-900/90">
      <div class="absolute -top-3 right-4 rounded-full bg-brand-500 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow-xs">
        Paket Aktif
      </div>
      <h3 class="text-base font-bold text-slate-900 dark:text-white">Growth</h3>
      <p class="mt-1 text-xs text-slate-500">Rekomendasi</p>
      <div class="mt-4">
        <span class="text-2xl font-bold font-mono">Rp 799.000</span>
        <span class="text-xs text-slate-400">/ bulan</span>
      </div>
      <ul class="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> 5.000 AI Units / bulan</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Maks. 5 Akun Sosial</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Full Auto Mode + Throttling</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Export Laporan CSV</li>
      </ul>
      <div class="mt-6 flex items-center justify-center rounded-xl bg-brand-500/10 py-2.5 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-500/20">
        Sedang Berlangganan
      </div>
    </div>

    <!-- Agency Pro -->
    <div class="soft-card soft-card-hover p-5.5">
      <h3 class="text-base font-bold text-slate-900 dark:text-white">Agency Pro</h3>
      <p class="mt-1 text-xs text-slate-500">Untuk agency & multi-brand management</p>
      <div class="mt-4">
        <span class="text-2xl font-bold font-mono">Rp 1.999.000</span>
        <span class="text-xs text-slate-400">/ bulan</span>
      </div>
      <ul class="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> 20.000 AI Units / bulan</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Hingga 20 Akun Sosial</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Opsi BYOK (API Key Sendiri)</li>
        <li class="flex items-center gap-2"><Check class="h-4 w-4 text-emerald-500" /> Dedicated SLA</li>
      </ul>
      <button type="button" class="mt-6 w-full rounded-xl border border-slate-200/80 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 shadow-2xs">
        Upgrade ke Agency
      </button>
    </div>
  </div>

  <!-- Invoices Table -->
  {#if billingData?.paymentHistory}
    <div class="soft-card p-5.5">
      <h2 class="text-sm font-bold text-slate-900 dark:text-white">
        Riwayat Transaksi & Pembayaran Midtrans
      </h2>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-100 font-semibold text-slate-500 dark:border-slate-800">
            <tr>
              <th class="py-2.5">No. Invoice</th>
              <th class="py-2.5">Jenis</th>
              <th class="py-2.5">Metode</th>
              <th class="py-2.5">Jumlah</th>
              <th class="py-2.5">Status</th>
              <th class="py-2.5">Tanggal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            {#each billingData.paymentHistory as p}
              <tr>
                <td class="py-3 font-mono font-bold text-slate-900 dark:text-white">{p.orderId}</td>
                <td class="py-3 capitalize">{p.kind === 'top_up' ? 'Top-Up Kuota' : 'Langganan Bulanan'}</td>
                <td class="py-3 uppercase text-slate-500">{p.paymentType || 'QRIS'}</td>
                <td class="py-3 font-mono font-semibold">Rp {p.amountIdr.toLocaleString('id-ID')}</td>
                <td class="py-3">
                  <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                    {p.status}
                  </span>
                </td>
                <td class="py-3 text-slate-400 font-mono">
                  {new Date(p.createdAt).toLocaleDateString('id-ID')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Top-Up Modal -->
{#if showTopUpModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
    <div class="glass-panel w-full max-w-md p-6 sm:p-7 shadow-2xl">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100/60 dark:border-slate-800/60">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Top-Up Kuota AI Units</h3>
        <button type="button" class="rounded-full p-2 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10" onclick={() => (showTopUpModal = false)}>
          <X class="h-4.5 w-4.5" />
        </button>
      </div>

      <div class="mt-4 space-y-4 text-xs">
        <p class="text-slate-500">Pilih paket unit tambahan untuk memperpanjang auto-reply tanpa upgrade tier.</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="rounded-2xl border p-4 text-left transition {selectedUnits === 500 ? 'border-brand-500 bg-brand-500/10 dark:bg-brand-500/20' : 'border-slate-200/80 bg-white/40 dark:border-slate-700/60 dark:bg-white/5'}"
            onclick={() => (selectedUnits = 500)}
          >
            <p class="text-sm font-bold text-slate-900 dark:text-white font-mono">+500 Units</p>
            <p class="mt-1 text-xs text-brand-500 font-semibold font-mono">Rp 150.000</p>
            <span class="text-[10px] text-slate-400">Rp 300 / komentar</span>
          </button>

          <button
            type="button"
            class="rounded-2xl border p-4 text-left transition {selectedUnits === 2000 ? 'border-brand-500 bg-brand-500/10 dark:bg-brand-500/20' : 'border-slate-200/80 bg-white/40 dark:border-slate-700/60 dark:bg-white/5'}"
            onclick={() => (selectedUnits = 2000)}
          >
            <p class="text-sm font-bold text-slate-900 dark:text-white font-mono">+2.000 Units</p>
            <p class="mt-1 text-xs text-brand-500 font-semibold font-mono">Rp 500.000</p>
            <span class="text-[10px] text-slate-400">Hemat 17%</span>
          </button>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          class="glass-pill px-4.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          onclick={() => (showTopUpModal = false)}
        >
          Batal
        </button>
        <button
          type="button"
          class="btn-primary-glass inline-flex items-center rounded-full px-5 py-2 text-xs font-semibold text-white shadow-md active:scale-95 disabled:opacity-50"
          onclick={handleTopUpCheckout}
          disabled={isCheckingOut}
        >
          {isCheckingOut ? 'Menyiapkan...' : 'Lanjut ke Midtrans Snap'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Simulated Midtrans Snap Popup Modal -->
{#if snapModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
    <div class="glass-panel w-full max-w-sm p-6 shadow-2xl">
      <div class="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <div class="h-6 w-6 rounded bg-sky-600 flex items-center justify-center text-white text-[10px] font-bold">M</div>
          <span class="text-sm font-bold text-slate-900 dark:text-white">Midtrans Snap Payment</span>
        </div>
        <button type="button" class="text-slate-400" onclick={() => (snapModalOpen = false)}>
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-4 text-center space-y-3">
        <p class="text-xs text-slate-500">Total Tagihan:</p>
        <p class="text-2xl font-bold font-mono text-slate-900 dark:text-white">
          Rp {activeAmount.toLocaleString('id-ID')}
        </p>

        <!-- QRIS Simulation -->
        <div class="mx-auto flex h-36 w-36 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          <QrCode class="h-28 w-28 text-slate-800 dark:text-slate-200" />
        </div>
        <p class="text-[11px] text-slate-400 font-mono">Scan QRIS via BCA / GoPay / Mandiri / ShopeePay</p>
      </div>

      <div class="mt-6 flex flex-col gap-2">
        <button
          type="button"
          class="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
          onclick={handlePaymentSuccess}
        >
          Simulasikan Pembayaran Berhasil
        </button>
        <button
          type="button"
          class="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          onclick={() => (snapModalOpen = false)}
        >
          Batalkan
        </button>
      </div>
    </div>
  </div>
{/if}
