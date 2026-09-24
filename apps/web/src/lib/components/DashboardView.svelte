<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Smile,
    Meh,
    Frown,
    ShieldAlert,
    Ban,
    Bot,
    Clock,
    ArrowUpRight,
    TrendingUp,
    ExternalLink,
    Sparkles,
    AlertTriangle,
    CheckCircle2
  } from 'lucide-svelte';
  import InstagramIcon from './icons/InstagramIcon.svelte';
  import FacebookIcon from './icons/FacebookIcon.svelte';
  import { api } from '../api';
  import type { DashboardSummary, DailyMetric, CommentItem, SocialAccount } from '../types';
  import Badge from './Badge.svelte';

  let {
    workspaceSlug = 'maujahit',
    isLangEn = false,
    onSelectPage = () => {}
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
    onSelectPage?: (page: string) => void;
  } = $props();

  let summary: DashboardSummary = $state({
    total: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    risk: 0,
    spam: 0,
    aiActivity: { autoReplied: 0, needsReview: 0, queued: 0, hidden: 0 },
    medianResponseSec: 360,
    responseTimeText: '6 Menit'
  });

  let trends: DailyMetric[] = $state([]);
  let recentComments: CommentItem[] = $state([]);
  let accounts: SocialAccount[] = $state([]);
  let loading: boolean = $state(true);

  onMount(async () => {
    loading = true;
    try {
      const [sumData, trendData, commentData, accountData] = await Promise.all([
        api.getSummary(workspaceSlug),
        api.getTrends(workspaceSlug),
        api.getComments(workspaceSlug),
        api.getAccounts(workspaceSlug)
      ]);
      summary = sumData;
      trends = trendData;
      recentComments = commentData.items.slice(0, 5);
      accounts = accountData;
    } finally {
      loading = false;
    }
  });

  let maxTotal = $derived(Math.max(...trends.map((t) => t.total), 1));
</script>

<div class="space-y-6">
  <!-- Top Welcome & Status Banner -->
  <div class="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs sm:flex-row sm:items-center">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          {isLangEn ? 'Moderation Dashboard' : 'Dashboard Moderasi Komentar'}
        </h1>
        <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Live
        </span>
      </div>
      <p class="mt-1 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Real-time AI monitoring & auto-reply performance for MauJahit.id'
          : 'Pantauan sentimen real-time dan performa auto-reply untuk MauJahit.id'}
      </p>
    </div>

    <!-- Quick Action / Alert if high risk -->
    {#if summary.risk > 0}
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-[#ea4335] px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#ea4335]/25 transition-all hover:bg-[#d93025] hover:shadow-[#ea4335]/35 hover:scale-[1.01] active:scale-98"
        onclick={() => onSelectPage('review')}
      >
        <ShieldAlert class="h-4 w-4" />
        <span>{summary.risk} {isLangEn ? 'Risk Comments Need Review' : 'Komentar Risiko Perlu Review'}</span>
        <ArrowUpRight class="h-4 w-4" />
      </button>
    {/if}
  </div>

  <!-- Metric KPI Cards Grid (6 semantic dimensions) -->
  <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
    <!-- Total -->
    <div class="soft-card soft-card-hover p-4">
      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
        <span class="text-xs font-medium">{isLangEn ? 'Total Comments' : 'Total Komentar'}</span>
        <TrendingUp class="h-4 w-4 text-slate-400" />
      </div>
      <p class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">{summary.total}</p>
      <span class="mt-1 inline-block text-[11px] text-slate-400 dark:text-slate-500">14 hari terakhir</span>
    </div>

    <!-- Positive -->
    <div class="soft-card soft-card-hover p-4 border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
      <div class="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
        <span class="text-xs font-medium">{isLangEn ? 'Positive' : 'Positif'}</span>
        <Smile class="h-4 w-4" />
      </div>
      <p class="mt-2 text-2xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 font-mono">{summary.positive}</p>
      <span class="mt-1 inline-block text-[11px] text-emerald-600/90 dark:text-emerald-400/90 font-medium">
        {summary.total > 0 ? Math.round((summary.positive / summary.total) * 100) : 0}% kepuasan
      </span>
    </div>

    <!-- Neutral -->
    <div class="soft-card soft-card-hover p-4">
      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
        <span class="text-xs font-medium">{isLangEn ? 'Neutral / Qs' : 'Netral / Tanya'}</span>
        <Meh class="h-4 w-4" />
      </div>
      <p class="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 font-mono">{summary.neutral}</p>
      <span class="mt-1 inline-block text-[11px] text-slate-400 dark:text-slate-500">Pertanyaan umum</span>
    </div>

    <!-- Negative -->
    <div class="soft-card soft-card-hover p-4 border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
      <div class="flex items-center justify-between text-amber-700 dark:text-amber-400">
        <span class="text-xs font-medium">{isLangEn ? 'Complaints' : 'Keluhan'}</span>
        <Frown class="h-4 w-4" />
      </div>
      <p class="mt-2 text-2xl font-bold tracking-tight text-amber-800 dark:text-amber-300 font-mono">{summary.negative}</p>
      <span class="mt-1 inline-block text-[11px] text-amber-600/90 dark:text-amber-400/90 font-medium">Drafted for review</span>
    </div>

    <!-- Risk (Toxic/Hate/Threat/Sensitive) -->
    <div class="soft-card soft-card-hover p-4 border-[#ea4335]/25 bg-[#ea4335]/5 dark:bg-[#ea4335]/10">
      <div class="flex items-center justify-between text-[#b3261e] dark:text-red-400">
        <span class="text-xs font-bold">{isLangEn ? 'Risk / Hate' : 'Risiko / SARA'}</span>
        <ShieldAlert class="h-4 w-4 text-[#ea4335]" />
      </div>
      <p class="mt-2 text-2xl font-bold tracking-tight text-[#b3261e] dark:text-red-300 font-mono">{summary.risk}</p>
      <span class="mt-1 inline-block text-[11px] text-[#ea4335]/90 font-medium dark:text-red-400/90">Tidak auto-reply</span>
    </div>

    <!-- Spam -->
    <div class="soft-card soft-card-hover p-4 border-violet-500/20 bg-violet-500/5 dark:bg-violet-500/10">
      <div class="flex items-center justify-between text-violet-700 dark:text-violet-400">
        <span class="text-xs font-medium">Spam / Judol</span>
        <Ban class="h-4 w-4" />
      </div>
      <p class="mt-2 text-2xl font-bold tracking-tight text-violet-800 dark:text-violet-300 font-mono">{summary.spam}</p>
      <span class="mt-1 inline-block text-[11px] text-violet-600/90 dark:text-violet-400/90 font-medium">Auto-hide active</span>
    </div>
  </div>

  <!-- Middle Grid: 14-Day Sentiment Trend Chart & AI Operations Widget -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Trend Chart (2 columns) -->
    <div class="soft-card p-5.5 lg:col-span-2">
      <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">
            {isLangEn ? '14-Day Comment Volume & Sentiment Trend' : 'Tren Volume Komentar & Sentimen (14 Hari)'}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {isLangEn ? 'Daily distribution of incoming comments' : 'Distribusi harian komentar masuk'}
          </p>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap items-center gap-3 text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span class="text-slate-600 dark:text-slate-300">Positif</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
            <span class="text-slate-600 dark:text-slate-300">Netral</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            <span class="text-slate-600 dark:text-slate-300">Negatif</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full bg-[#ea4335]"></span>
            <span class="text-slate-600 dark:text-slate-300">Risiko</span>
          </div>
        </div>
      </div>

      <!-- Interactive SVG Chart Bar Visualizer -->
      <div class="mt-6 flex h-48 items-end gap-1.5 pt-4 sm:gap-2.5">
        {#each trends as t}
          {@const posHeight = Math.max(4, Math.round((t.positive / maxTotal) * 160))}
          {@const neuHeight = Math.max(2, Math.round((t.neutral / maxTotal) * 160))}
          {@const negHeight = Math.max(2, Math.round((t.negative / maxTotal) * 160))}
          {@const riskHeight = Math.max(2, Math.round((t.risk / maxTotal) * 160))}
          <div class="group relative flex flex-1 flex-col items-center justify-end h-full">
            <!-- Tooltip -->
            <div class="pointer-events-none absolute -top-12 z-20 hidden w-32 rounded-xl bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 text-center text-[10px] text-white shadow-xl group-hover:block dark:bg-slate-800/95 border border-white/10">
              <p class="font-bold">{t.day}</p>
              <p>Total: {t.total} (Pos: {t.positive}, Risk: {t.risk})</p>
            </div>

            <!-- Stacked bar -->
            <div class="flex w-full flex-col justify-end overflow-hidden rounded-t-md transition group-hover:opacity-85">
              <div class="w-full bg-[#ea4335]/90" style="height: {riskHeight}px" title="Risiko: {t.risk}"></div>
              <div class="w-full bg-amber-500/90" style="height: {negHeight}px" title="Negatif: {t.negative}"></div>
              <div class="w-full bg-slate-300 dark:bg-slate-700" style="height: {neuHeight}px" title="Netral: {t.neutral}"></div>
              <div class="w-full bg-emerald-500/90" style="height: {posHeight}px" title="Positif: {t.positive}"></div>
            </div>

            <!-- Day label -->
            <span class="mt-2 text-[10px] text-slate-400 font-mono">
              {t.day.slice(8)}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <!-- AI Operations & Velocity Card -->
    <div class="flex flex-col justify-between soft-card p-5.5">
      <div>
        <div class="flex items-center gap-2 text-[#ea4335] dark:text-red-400">
          <Bot class="h-5 w-5" />
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">
            {isLangEn ? 'AI Operations Activity' : 'Aktivitas Otomasi AI'}
          </h2>
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isLangEn ? 'Breakdown of AI lifecycle decisions' : 'Ringkasan keputusan otomatisasi sistem'}
        </p>

        <div class="mt-5 space-y-3">
          <div class="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Auto-Replied (Sent)</span>
            <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">{summary.aiActivity.autoReplied}</span>
          </div>

          <div class="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Antrean Review (Human)</span>
            <span class="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">{summary.aiActivity.needsReview}</span>
          </div>

          <div class="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Auto-Hide Spam</span>
            <span class="text-sm font-bold text-violet-600 dark:text-violet-400 font-mono">{summary.aiActivity.hidden}</span>
          </div>
        </div>
      </div>

      <!-- Median Response Velocity -->
      <div class="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Clock class="h-4 w-4 text-emerald-600" />
          <span>{isLangEn ? 'Median Response Time' : 'Kecepatan Respon Rata-rata'}</span>
        </div>
        <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white font-mono">{summary.responseTimeText}</p>
        <span class="text-[10px] text-slate-500 dark:text-slate-400">Target pilot MauJahit: &lt; 15 menit (Target Tercapai)</span>
      </div>
    </div>
  </div>

  <!-- Connected Accounts Preview & Recent Live Stream -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Connected Channels Status -->
    <div class="soft-card p-5.5">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">
          {isLangEn ? 'Connected Channels' : 'Koneksi Channel Sosial'}
        </h2>
        <button
          type="button"
          class="text-xs font-semibold text-[#ea4335] hover:underline dark:text-red-400"
          onclick={() => onSelectPage('accounts')}
        >
          {isLangEn ? 'Manage' : 'Kelola'}
        </button>
      </div>

      <div class="mt-4 space-y-3">
        {#each accounts as acc}
          <div class="flex items-center justify-between rounded-xl border border-slate-200/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div class="flex items-center gap-3">
              {#if acc.platform === 'instagram'}
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400">
                  <InstagramIcon class="h-5 w-5" />
                </div>
              {:else if acc.platform === 'facebook'}
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <FacebookIcon class="h-5 w-5" />
                </div>
              {:else}
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span class="text-xs font-bold">TT</span>
                </div>
              {/if}
              <div>
                <p class="text-xs font-semibold text-slate-900 dark:text-white">{acc.username}</p>
                <div class="flex items-center gap-1.5 text-[10px]">
                  {#if acc.status === 'connected'}
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span class="text-emerald-600 dark:text-emerald-400">Connected</span>
                  {:else}
                    <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    <span class="text-amber-600 dark:text-amber-400">Fase 2 (Pending)</span>
                  {/if}
                </div>
              </div>
            </div>

            <div class="text-right">
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 uppercase">
                {acc.policy?.mode || 'shadow'}
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Recent Comments Live Feed (2 columns) -->
    <div class="soft-card p-5.5 lg:col-span-2">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">
            {isLangEn ? 'Latest Incoming Comments' : 'Komentar Masuk Terbaru'}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {isLangEn ? 'Real-time classification and response status' : 'Klasifikasi real-time & status tindakan'}
          </p>
        </div>
        <button
          type="button"
          class="text-xs font-semibold text-[#ea4335] hover:underline dark:text-red-400"
          onclick={() => onSelectPage('comments')}
        >
          {isLangEn ? 'View All' : 'Lihat Semua'}
        </button>
      </div>

      <div class="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {#each recentComments as item}
          <div class="py-3 first:pt-0 last:pb-0">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold text-slate-900 dark:text-white">@{item.authorName}</span>
                  <span class="text-[10px] text-slate-400 font-mono">
                    {new Date(item.commentedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {#if item.classification}
                    <Badge type="sentiment" value={item.classification.sentiment} />
                    {#if item.classification.riskLabel !== 'none'}
                      <Badge type="risk" value={item.classification.riskLabel} />
                    {/if}
                  {/if}
                  <Badge type="status" value={item.status} />
                </div>
                <p class="text-xs text-slate-700 dark:text-slate-300">
                  {item.text}
                </p>
                {#if item.reply?.finalText}
                  <p class="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
                    <span class="font-semibold">Balasan terkirim:</span> {item.reply.finalText}
                  </p>
                {/if}
              </div>

              {#if item.status === 'NEEDS_REVIEW'}
                <button
                  type="button"
                  class="shrink-0 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                  onclick={() => onSelectPage('review')}
                >
                  Review
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
