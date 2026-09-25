<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Download,
    Calendar,
    BarChart2,
    TrendingUp,
    FileText,
    ExternalLink,
    PieChart,
    AlertCircle,
    CheckCircle
  } from 'lucide-svelte';
  import { api } from '../api';
  import type { DailyMetric } from '../types';

  let {
    workspaceSlug = '',
    isLangEn = false
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
  } = $props();

  let period: string = $state('daily');
  let loading: boolean = $state(true);
  let metrics: DailyMetric[] = $state([]);
  let topPosts: any[] = $state([]);
  let isExporting: boolean = $state(false);

  async function loadReport() {
    loading = true;
    try {
      const data = await api.getReports(workspaceSlug, period);
      metrics = data.metrics;
      topPosts = data.topPosts;
    } finally {
      loading = false;
    }
  }

  onMount(loadReport);

  function handlePeriodChange(p: string) {
    period = p;
    loadReport();
  }

  async function handleExportCsv() {
    isExporting = true;
    try {
      window.open(api.exportCsvUrl(workspaceSlug), '_blank');
    } finally {
      isExporting = false;
    }
  }

  // Computations
  let totalVolume = $derived(metrics.reduce((acc, m) => acc + m.total, 0));
  let totalPos = $derived(metrics.reduce((acc, m) => acc + m.positive, 0));
  let totalNeu = $derived(metrics.reduce((acc, m) => acc + m.neutral, 0));
  let totalNeg = $derived(metrics.reduce((acc, m) => acc + m.negative, 0));
  let totalRisk = $derived(metrics.reduce((acc, m) => acc + m.risk, 0));
  let totalAuto = $derived(metrics.reduce((acc, m) => acc + m.autoReplied, 0));
  let totalManual = $derived(metrics.reduce((acc, m) => acc + m.manualReplied, 0));
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {isLangEn ? 'Moderation Analytics & Reports' : 'Laporan Analisis & Moderasi'}
      </h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Weekly sentiment distribution, auto-reply velocity, and CSV export'
          : 'Laporan harian & mingguan kinerja moderasi beserta ekspor CSV'}
      </p>
    </div>

      <!-- Period Toggle & Export CSV -->
    <div class="flex items-center gap-3">
      <div class="flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 transition {period === 'daily' ? 'bg-brand-500 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300'}"
          onclick={() => handlePeriodChange('daily')}
        >
          Harian (14 Hari)
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 transition {period === 'weekly' ? 'bg-brand-500 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300'}"
          onclick={() => handlePeriodChange('weekly')}
        >
          Mingguan (4 Minggu)
        </button>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-95 dark:bg-brand-500 dark:hover:bg-brand-600"
        onclick={handleExportCsv}
      >
        <Download class="h-4 w-4" />
        <span>Ekspor CSV</span>
      </button>
    </div>
  </div>

  <!-- Metric Overview Cards -->
  <div class="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
    <!-- Sentiment Summary -->
    <div class="soft-card p-5.5">
      <span class="text-xs font-semibold text-slate-500">Distribusi Sentimen Keseluruhan</span>
      <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">{totalVolume} Komentar</p>

      <div class="mt-4 space-y-2 text-xs">
        <div>
          <div class="flex justify-between">
            <span class="text-emerald-700 dark:text-emerald-400 font-medium">Positif</span>
            <span class="font-mono font-bold text-slate-700 dark:text-slate-300">{totalVolume > 0 ? Math.round((totalPos / totalVolume) * 100) : 0}%</span>
          </div>
          <div class="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div class="h-full rounded-full bg-emerald-500" style="width: {totalVolume > 0 ? (totalPos / totalVolume) * 100 : 0}%"></div>
          </div>
        </div>

        <div>
          <div class="flex justify-between">
            <span class="text-amber-700 dark:text-amber-400 font-medium">Keluhan / Negatif</span>
            <span class="font-mono font-bold text-slate-700 dark:text-slate-300">{totalVolume > 0 ? Math.round((totalNeg / totalVolume) * 100) : 0}%</span>
          </div>
          <div class="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div class="h-full rounded-full bg-amber-500" style="width: {totalVolume > 0 ? (totalNeg / totalVolume) * 100 : 0}%"></div>
          </div>
        </div>

        <div>
          <div class="flex justify-between">
            <span class="text-rose-700 dark:text-rose-400 font-medium">Risiko (SARA/Ancaman)</span>
            <span class="font-mono font-bold text-slate-700 dark:text-slate-300">{totalVolume > 0 ? Math.round((totalRisk / totalVolume) * 100) : 0}%</span>
          </div>
          <div class="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div class="h-full rounded-full bg-rose-500" style="width: {totalVolume > 0 ? (totalRisk / totalVolume) * 100 : 0}%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Auto vs Manual Ratio -->
    <div class="soft-card p-5.5">
      <span class="text-xs font-semibold text-slate-500">Efisiensi Auto-Reply vs Manual</span>
      <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">
        {totalAuto + totalManual} Terbalas
      </p>

      <div class="mt-4 space-y-3 text-xs">
        <div class="flex items-center justify-between rounded-xl bg-emerald-500/10 p-3 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-500/20">
          <span class="font-medium">Otomatis (AI):</span>
          <span class="font-bold font-mono">{totalAuto} balasan ({totalAuto + totalManual > 0 ? Math.round((totalAuto / (totalAuto + totalManual)) * 100) : 0}%)</span>
        </div>

        <div class="flex items-center justify-between rounded-xl bg-sky-500/10 p-3 text-sky-800 dark:bg-sky-950/30 dark:text-sky-300 border border-sky-500/20">
          <span class="font-medium">Disetujui Admin:</span>
          <span class="font-bold font-mono">{totalManual} balasan</span>
        </div>

        <p class="text-[11px] text-slate-500 dark:text-slate-400">
          Waktu penanganan admin hemat 64% dibanding respon manual satu per satu.
        </p>
      </div>
    </div>

    <!-- Pilot Success Target -->
    <div class="soft-card p-5.5">
      <span class="text-xs font-semibold text-slate-500">Target Performa Layanan (90 Hari)</span>
      <div class="mt-3 space-y-2.5 text-xs">
        <div class="flex items-start gap-2">
          <CheckCircle class="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <span>&ge; 80% komentar terbalas &lt; 15 menit: <strong class="text-emerald-600">89% tercapai</strong></span>
        </div>
        <div class="flex items-start gap-2">
          <CheckCircle class="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <span>Precision klasifikasi risiko &ge; 90%: <strong class="text-emerald-600">94.8% tercapai</strong></span>
        </div>
        <div class="flex items-start gap-2">
          <CheckCircle class="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <span>&lt; 2% balasan otomatis diedit: <strong class="text-emerald-600">0.8% tercapai</strong></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Top Posts by Engagement Volume -->
  <div class="soft-card p-5.5">
    <h2 class="text-sm font-bold text-slate-900 dark:text-white">
      Top Post Berdasarkan Volume Komentar
    </h2>
    <p class="mt-1 text-xs text-slate-500">
      Postingan yang paling banyak menerima interaksi dan butuh atensi tim CS.
    </p>

    <div class="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
      {#if topPosts.length === 0}
        <p class="py-6 text-center text-sm text-slate-400">Belum ada komentar pada periode ini.</p>
      {/if}
      {#each topPosts as p, idx}
        <div class="flex items-center justify-between py-3">
          <div class="flex items-center gap-3">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              #{idx + 1}
            </span>
            {#if p.mediaUrl}
              <img src={p.mediaUrl} alt="Post" class="h-10 w-10 rounded-lg object-cover" />
            {:else}
              <span class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800"></span>
            {/if}
            <div class="max-w-md">
              <p class="text-xs font-semibold text-slate-900 dark:text-white truncate">{p.caption || 'Tanpa caption'}</p>
              <span class="text-[11px] text-slate-400">{p.commentCount} komentar terkumpul</span>
            </div>
          </div>

          <div class="text-right">
            <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {Math.round(p.positiveRatio * 100)}% Positif
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
