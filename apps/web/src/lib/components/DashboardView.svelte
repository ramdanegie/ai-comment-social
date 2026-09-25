<script lang="ts">
  import { onMount } from 'svelte';
  import { ShieldAlert, ArrowRight, Clock, CheckCircle2, AlertTriangle } from 'lucide-svelte';
  import InstagramIcon from './icons/InstagramIcon.svelte';
  import FacebookIcon from './icons/FacebookIcon.svelte';
  import TiktokIcon from './icons/TiktokIcon.svelte';
  import { api } from '../api';
  import type { DashboardSummary, DailyMetric, CommentItem, SocialAccount } from '../types';
  import Badge from './Badge.svelte';
  import { timeAgo, formatNumber } from '$lib/format';

  let {
    workspaceSlug = 'maujahit',
    isLangEn = false,
    onSelectPage = () => {}
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
    onSelectPage?: (page: string) => void;
  } = $props();

  const RESPONSE_TARGET_SEC = 15 * 60; // PRD success metric: < 15 menit

  let summary = $state<DashboardSummary | null>(null);
  let trends: DailyMetric[] = $state([]);
  let recentComments: CommentItem[] = $state([]);
  let accounts: SocialAccount[] = $state([]);
  let loading = $state(true);
  let hoveredDay = $state<string | null>(null);

  onMount(async () => {
    try {
      const [sumData, trendData, commentData, accountData] = await Promise.all([
        api.getSummary(workspaceSlug),
        api.getTrends(workspaceSlug),
        api.getComments(workspaceSlug),
        api.getAccounts(workspaceSlug)
      ]);
      summary = sumData;
      trends = trendData;
      recentComments = commentData.items.slice(0, 6);
      accounts = accountData;
    } finally {
      loading = false;
    }
  });

  const pct = (n: number) => (summary && summary.total > 0 ? Math.round((n / summary.total) * 100) : 0);

  let kpis = $derived(
    summary
      ? [
          { key: 'positive', label: isLangEn ? 'Positive' : 'Positif', value: summary.positive, dot: 'bg-emerald-500' },
          { key: 'neutral', label: isLangEn ? 'Neutral' : 'Netral', value: summary.neutral, dot: 'bg-slate-400' },
          { key: 'negative', label: isLangEn ? 'Negative' : 'Negatif', value: summary.negative, dot: 'bg-amber-500' },
          { key: 'risk', label: isLangEn ? 'Risk' : 'Berisiko', value: summary.risk, dot: 'bg-rose-500' },
          { key: 'spam', label: 'Spam', value: summary.spam, dot: 'bg-red-500' }
        ]
      : []
  );

  // Chart scale: round the max up to a "nice" number so gridlines land on readable values.
  let chartMax = $derived.by(() => {
    const max = Math.max(...trends.map((t) => t.total), 1);
    const step = max <= 10 ? 5 : max <= 50 ? 10 : max <= 200 ? 50 : 100;
    return Math.ceil(max / step) * step;
  });
  let gridlines = $derived([chartMax, chartMax / 2, 0]);

  const dayLabel = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(isLangEn ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short' });

  let onTarget = $derived((summary?.medianResponseSec ?? 0) <= RESPONSE_TARGET_SEC);

  const minutes = (sec: number) => Math.max(1, Math.round(sec / 60));
</script>

{#snippet platformIcon(platform: string)}
  {#if platform === 'instagram'}
    <InstagramIcon class="h-4 w-4" />
  {:else if platform === 'facebook'}
    <FacebookIcon class="h-4 w-4" />
  {:else}
    <TiktokIcon class="h-4 w-4" />
  {/if}
{/snippet}

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Dashboard</h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      {isLangEn ? 'Comment sentiment and AI reply activity' : 'Sentimen komentar dan aktivitas balasan AI'}
    </p>
  </div>

  {#if loading || !summary}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {#each Array(6) as _}
        <div class="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
      {/each}
    </div>
    <div class="h-72 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
  {:else}
    <!-- Attention banner: the one thing an admin should do next -->
    {#if summary.aiActivity.needsReview > 0}
      <button
        type="button"
        onclick={() => onSelectPage('review')}
        class="group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition {summary.risk > 0
          ? 'border-rose-200 bg-rose-50 hover:bg-rose-100/70 dark:border-rose-900/60 dark:bg-rose-950/30'
          : 'border-amber-200 bg-amber-50 hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-950/30'}"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {summary.risk > 0
            ? 'bg-rose-600 text-white'
            : 'bg-amber-500 text-white'}"
        >
          <ShieldAlert class="h-5 w-5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-slate-900 dark:text-white">
            {summary.aiActivity.needsReview}
            {isLangEn ? 'comments are waiting for your review' : 'komentar menunggu review'}
          </span>
          {#if summary.risk > 0}
            <span class="block text-xs text-rose-700 dark:text-rose-300">
              {summary.risk} {isLangEn ? 'of them are high risk' : 'di antaranya berisiko tinggi'}
            </span>
          {/if}
        </span>
        <span class="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          {isLangEn ? 'Open queue' : 'Buka antrean'}
          <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    {/if}

    <!-- KPIs -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div class="soft-card col-span-2 p-4 sm:col-span-1">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{isLangEn ? 'Total comments' : 'Total komentar'}</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
          {formatNumber(summary.total)}
        </p>
      </div>
      {#each kpis as k (k.key)}
        <div class="soft-card p-4">
          <p class="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span class="h-2 w-2 rounded-full {k.dot}"></span>
            {k.label}
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
            {formatNumber(k.value)}
          </p>
          <p class="mt-0.5 text-xs tabular-nums text-slate-400">{pct(k.value)}%</p>
        </div>
      {/each}
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Trend chart -->
      <section class="soft-card p-5 lg:col-span-2">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
              {isLangEn ? 'Comments per day' : 'Komentar per hari'}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">{isLangEn ? 'Last 14 days' : '14 hari terakhir'}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-emerald-500"></span>{isLangEn ? 'Positive' : 'Positif'}</span>
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-slate-300 dark:bg-slate-600"></span>{isLangEn ? 'Neutral' : 'Netral'}</span>
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-amber-500"></span>{isLangEn ? 'Negative' : 'Negatif'}</span>
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-rose-500"></span>{isLangEn ? 'Risk' : 'Berisiko'}</span>
          </div>
        </div>

        {#if trends.length === 0}
          <p class="mt-10 mb-6 text-center text-sm text-slate-400">
            {isLangEn ? 'No data yet.' : 'Belum ada data.'}
          </p>
        {:else}
          <div class="mt-6 flex gap-3">
            <!-- Y axis -->
            <div class="flex h-52 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-slate-400">
              {#each gridlines as g}<span class="-translate-y-1/2 leading-none">{g}</span>{/each}
            </div>

            <div class="relative flex-1">
              <!-- Gridlines -->
              <div class="pointer-events-none absolute inset-x-0 top-0 flex h-46 flex-col justify-between">
                {#each gridlines as _}<div class="border-t border-dashed border-slate-200 dark:border-slate-800"></div>{/each}
              </div>

              <div class="relative flex h-52 items-end gap-1 sm:gap-2">
                {#each trends as t (t.day)}
                  {@const h = (n: number) => `${(n / chartMax) * 100}%`}
                  <button
                    type="button"
                    class="group relative flex h-full flex-1 cursor-default flex-col justify-end rounded outline-none"
                    aria-label="{dayLabel(t.day)}: {t.total} komentar, {t.positive} positif, {t.neutral} netral, {t.negative} negatif, {t.risk} berisiko"
                    onmouseenter={() => (hoveredDay = t.day)}
                    onmouseleave={() => (hoveredDay = null)}
                    onfocus={() => (hoveredDay = t.day)}
                    onblur={() => (hoveredDay = null)}
                  >
                    {#if hoveredDay === t.day}
                      <div class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-36 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-700">
                        <p class="font-semibold">{dayLabel(t.day)} · {t.total}</p>
                        <p class="mt-1 flex justify-between"><span class="text-emerald-300">{isLangEn ? 'Positive' : 'Positif'}</span><span class="tabular-nums">{t.positive}</span></p>
                        <p class="flex justify-between"><span class="text-slate-300">{isLangEn ? 'Neutral' : 'Netral'}</span><span class="tabular-nums">{t.neutral}</span></p>
                        <p class="flex justify-between"><span class="text-amber-300">{isLangEn ? 'Negative' : 'Negatif'}</span><span class="tabular-nums">{t.negative}</span></p>
                        <p class="flex justify-between"><span class="text-rose-300">{isLangEn ? 'Risk' : 'Berisiko'}</span><span class="tabular-nums">{t.risk}</span></p>
                      </div>
                    {/if}
                    <div class="flex h-46 flex-col justify-end">
                      <div
                        class="flex flex-col overflow-hidden rounded-t transition-opacity {hoveredDay && hoveredDay !== t.day ? 'opacity-50' : ''}"
                        style="height: {h(t.total)}"
                      >
                        <div class="bg-rose-500" style="flex: {t.risk}"></div>
                        <div class="bg-amber-500" style="flex: {t.negative}"></div>
                        <div class="bg-slate-300 dark:bg-slate-600" style="flex: {t.neutral}"></div>
                        <div class="bg-emerald-500" style="flex: {t.positive}"></div>
                      </div>
                    </div>
                    <span class="mt-2 h-4 truncate text-center text-[10px] text-slate-400">{dayLabel(t.day).split(' ')[0]}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </section>

      <!-- AI activity -->
      <section class="soft-card flex flex-col p-5">
        <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{isLangEn ? 'AI activity' : 'Aktivitas AI'}</h2>
        <dl class="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-slate-600 dark:text-slate-300">{isLangEn ? 'Auto-replied' : 'Dibalas otomatis'}</dt>
            <dd class="font-semibold tabular-nums text-slate-900 dark:text-white">{summary.aiActivity.autoReplied}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-slate-600 dark:text-slate-300">{isLangEn ? 'Waiting for review' : 'Menunggu review'}</dt>
            <dd class="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{summary.aiActivity.needsReview}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-slate-600 dark:text-slate-300">{isLangEn ? 'Queued to send' : 'Antre dikirim'}</dt>
            <dd class="font-semibold tabular-nums text-slate-900 dark:text-white">{summary.aiActivity.queued}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-slate-600 dark:text-slate-300">{isLangEn ? 'Spam hidden' : 'Spam disembunyikan'}</dt>
            <dd class="font-semibold tabular-nums text-slate-900 dark:text-white">{summary.aiActivity.hidden}</dd>
          </div>
        </dl>

        <div class="mt-auto rounded-xl bg-slate-50 p-4 pt-4 dark:bg-slate-800/50">
          <p class="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Clock class="h-3.5 w-3.5" />
            {isLangEn ? 'Median response time' : 'Median waktu respons'}
          </p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {minutes(summary.medianResponseSec)} <span class="text-base font-normal text-slate-500">{isLangEn ? 'min' : 'menit'}</span>
          </p>
          <p class="mt-1 flex items-center gap-1 text-xs {onTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">
            {#if onTarget}<CheckCircle2 class="h-3.5 w-3.5" />{:else}<AlertTriangle class="h-3.5 w-3.5" />{/if}
            {isLangEn ? 'Target' : 'Target'} &lt; 15 {isLangEn ? 'min' : 'menit'}
          </p>
        </div>
      </section>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Accounts -->
      <section class="soft-card p-5">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{isLangEn ? 'Accounts' : 'Akun terhubung'}</h2>
          <button type="button" class="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onclick={() => onSelectPage('accounts')}>
            {isLangEn ? 'Manage' : 'Kelola'}
          </button>
        </div>
        <ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {#each accounts as acc (acc.id)}
            <li class="flex items-center gap-3 py-2.5">
              <span class="text-slate-500 dark:text-slate-400">{@render platformIcon(acc.platform)}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-slate-900 dark:text-white">{acc.username}</span>
                <span class="flex items-center gap-1.5 text-xs {acc.status === 'connected' ? 'text-slate-500' : 'text-amber-600 dark:text-amber-400'}">
                  <span class="h-1.5 w-1.5 rounded-full {acc.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                  {acc.status === 'connected'
                    ? isLangEn ? 'Connected' : 'Terhubung'
                    : acc.status === 'expired'
                      ? isLangEn ? 'Reconnect needed' : 'Perlu hubungkan ulang'
                      : isLangEn ? 'Pending' : 'Menunggu'}
                </span>
              </span>
              <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {acc.policy?.mode ?? 'shadow'}
              </span>
            </li>
          {:else}
            <li class="py-6 text-center text-sm text-slate-400">
              {isLangEn ? 'No accounts connected yet.' : 'Belum ada akun terhubung.'}
            </li>
          {/each}
        </ul>
      </section>

      <!-- Recent comments -->
      <section class="soft-card p-5 lg:col-span-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{isLangEn ? 'Latest comments' : 'Komentar terbaru'}</h2>
          <button type="button" class="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onclick={() => onSelectPage('comments')}>
            {isLangEn ? 'View all' : 'Lihat semua'}
          </button>
        </div>
        <ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {#each recentComments as item (item.id)}
            <li class="flex items-start gap-3 py-3">
              <span class="mt-0.5 text-slate-400">{@render platformIcon(item.platform)}</span>
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span class="font-semibold text-slate-900 dark:text-white">@{item.authorName}</span>
                  <span class="text-slate-400">{timeAgo(item.commentedAt, isLangEn)}</span>
                </div>
                <p class="line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{item.text}</p>
                {#if item.status === 'REPLIED' && item.reply?.finalText}
                  <p class="line-clamp-1 text-xs text-slate-500">
                    <span class="font-medium text-emerald-600 dark:text-emerald-400">↳ {isLangEn ? 'Replied:' : 'Dibalas:'}</span>
                    {item.reply.finalText}
                  </p>
                {/if}
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                {#if item.classification && item.classification.riskLabel !== 'none'}
                  <Badge type="risk" value={item.classification.riskLabel} />
                {:else if item.classification}
                  <Badge type="sentiment" value={item.classification.sentiment} />
                {/if}
                <Badge type="status" value={item.status} />
              </div>
            </li>
          {/each}
        </ul>
      </section>
    </div>
  {/if}
</div>
