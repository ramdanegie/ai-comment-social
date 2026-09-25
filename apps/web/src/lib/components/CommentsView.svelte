<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search,
    Filter,
    ArrowUpDown,
    CheckCircle,
    Eye,
    Tag,
    X,
    ExternalLink,
    Sparkles,
    ShieldAlert
  } from 'lucide-svelte';
  import InstagramIcon from './icons/InstagramIcon.svelte';
  import FacebookIcon from './icons/FacebookIcon.svelte';
  import { api } from '../api';
  import type { CommentItem, Sentiment, RiskLabel } from '../types';
  import Badge from './Badge.svelte';

  let {
    workspaceSlug = '',
    isLangEn = false
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
  } = $props();

  let comments: CommentItem[] = $state([]);
  let loading: boolean = $state(true);
  let activeTab: string = $state('all'); // all | NEEDS_REVIEW | REPLIED | risk | spam
  let searchInput: string = $state('');
  let selectedPlatform: string = $state('all');
  let selectedSentiment: string = $state('all');

  // Detail Modal State
  let activeDetailComment: CommentItem | null = $state(null);

  // Label Correction Modal State (F13)
  let correctingComment: CommentItem | null = $state(null);
  let correctSentiment: Sentiment = $state('positive');
  let correctRisk: RiskLabel = $state('none');
  let isSavingLabel: boolean = $state(false);

  async function loadData() {
    loading = true;
    try {
      const filters: any = {};
      if (activeTab === 'NEEDS_REVIEW' || activeTab === 'REPLIED') {
        filters.status = activeTab;
      } else if (activeTab === 'risk') {
        filters.risk = 'risk';
      } else if (activeTab === 'spam') {
        filters.risk = 'spam';
      }

      if (selectedPlatform !== 'all') filters.platform = selectedPlatform;
      if (selectedSentiment !== 'all') filters.sentiment = selectedSentiment;
      if (searchInput.trim()) filters.search = searchInput.trim();

      const res = await api.getComments(workspaceSlug, filters);
      comments = res.items;
    } finally {
      loading = false;
    }
  }

  onMount(loadData);

  function handleTabChange(tab: string) {
    activeTab = tab;
    loadData();
  }

  function handleFilterSubmit() {
    loadData();
  }

  function openCorrectionModal(c: CommentItem) {
    correctingComment = c;
    correctSentiment = c.classification?.sentiment || 'positive';
    correctRisk = c.classification?.riskLabel || 'none';
  }

  async function saveLabelCorrection() {
    if (!correctingComment) return;
    isSavingLabel = true;
    try {
      await api.correctLabel(workspaceSlug, correctingComment.id, correctSentiment, correctRisk);
      if (correctingComment.classification) {
        correctingComment.classification.sentiment = correctSentiment;
        correctingComment.classification.riskLabel = correctRisk;
      }
      correctingComment = null;
    } finally {
      isSavingLabel = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {isLangEn ? 'All Comments Explorer' : 'Eksplorasi Semua Komentar'}
      </h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Browse, filter, and audit all platform comments across Instagram & Facebook'
          : 'Daftar riwayat, filter status, dan audit komentar media sosial workspace Anda'}
      </p>
    </div>
  </div>

  <!-- Filter & Search Bar -->
  <div class="flex flex-col gap-3.5 soft-card p-4">
    <!-- Status Tabs -->
    <div class="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800/80">
      {#each [
        { id: 'all', label: isLangEn ? 'All Comments' : 'Semua Komentar' },
        { id: 'NEEDS_REVIEW', label: isLangEn ? 'Needs Review' : 'Perlu Review' },
        { id: 'REPLIED', label: isLangEn ? 'Auto-Replied' : 'Terbalas' },
        { id: 'risk', label: isLangEn ? 'High Risk' : 'Berisiko / SARA' },
        { id: 'spam', label: 'Spam' }
      ] as tab}
        <button
          type="button"
          class="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all {activeTab === tab.id
            ? 'bg-brand-500/12 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 shadow-2xs border border-brand-500/25'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'}"
          onclick={() => handleTabChange(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Search & Dropdown Filters -->
    <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <!-- Search Input -->
      <div class="relative flex-1">
        <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder={isLangEn ? 'Search comment text or @author...' : 'Cari teks komentar atau @nama akun...'}
          bind:value={searchInput}
          onkeydown={(e) => e.key === 'Enter' && handleFilterSubmit()}
          class="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-900 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <!-- Platform Dropdown -->
      <select
        bind:value={selectedPlatform}
        onchange={loadData}
        class="h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 transition focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="all">Semua Platform</option>
        <option value="instagram">Instagram</option>
        <option value="facebook">Facebook</option>
      </select>

      <!-- Sentiment Dropdown -->
      <select
        bind:value={selectedSentiment}
        onchange={loadData}
        class="h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 transition focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="all">Semua Sentimen</option>
        <option value="positive">Positif</option>
        <option value="neutral">Netral</option>
        <option value="negative">Negatif</option>
      </select>

      <button
        type="button"
        class="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-brand-500 dark:hover:bg-brand-600"
        onclick={loadData}
      >
        Filter
      </button>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="space-y-3">
      {#each [1, 2, 3] as _}
        <div class="h-20 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
      {/each}
    </div>
  {:else if comments.length === 0}
    <!-- Empty State -->
    <div class="soft-card flex flex-col items-center justify-center py-16 text-center">
      <Filter class="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p class="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Tidak ada komentar yang cocok</p>
      <p class="text-xs text-slate-500">Coba ubah kata kunci pencarian atau reset filter.</p>
    </div>
  {:else}
    <!-- 1. Desktop Table View (>= 768px) -->
    <div class="hidden overflow-hidden soft-card md:block">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-100 bg-slate-50/70 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
          <tr>
            <th class="py-3 pl-4 pr-3">Author & Komentar</th>
            <th class="px-3 py-3">Platform</th>
            <th class="px-3 py-3">Sentimen & Risiko</th>
            <th class="px-3 py-3">Status</th>
            <th class="px-3 py-3">Waktu</th>
            <th class="py-3 pl-3 pr-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          {#each comments as c}
            <tr class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
              <!-- Author & Comment -->
              <td class="py-3.5 pl-4 pr-3 max-w-sm">
                <div class="font-bold text-slate-900 dark:text-white">@{c.authorName}</div>
                <p class="mt-1 line-clamp-2 text-slate-700 dark:text-slate-300 leading-snug">
                  {c.text}
                </p>
                {#if c.reply?.finalText}
                  <div class="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
                    <span class="font-medium text-slate-400 dark:text-slate-500">Balasan:</span> {c.reply.finalText}
                  </div>
                {/if}
              </td>

              <!-- Platform -->
              <td class="px-3 py-3.5 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  {#if c.platform === 'instagram'}
                    <InstagramIcon class="h-4 w-4 text-pink-500" />
                    <span>Instagram</span>
                  {:else}
                    <FacebookIcon class="h-4 w-4 text-blue-600" />
                    <span>Facebook</span>
                  {/if}
                </div>
              </td>

              <!-- Sentiment & Risk -->
              <td class="px-3 py-3.5 whitespace-nowrap">
                <div class="flex flex-col gap-1 items-start">
                  {#if c.classification}
                    <Badge type="sentiment" value={c.classification.sentiment} />
                    {#if c.classification.riskLabel !== 'none'}
                      <Badge type="risk" value={c.classification.riskLabel} />
                    {/if}
                  {/if}
                </div>
              </td>

              <!-- Status -->
              <td class="px-3 py-3.5 whitespace-nowrap">
                <Badge type="status" value={c.status} />
              </td>

              <!-- Waktu -->
              <td class="px-3 py-3.5 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                {new Date(c.commentedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </td>

              <!-- Aksi -->
              <td class="py-3.5 pl-3 pr-4 text-right whitespace-nowrap space-x-1">
                <button
                  type="button"
                  class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  onclick={() => (activeDetailComment = c)}
                  title="Lihat Detail Komentar"
                >
                  <Eye class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="rounded-lg p-1.5 text-brand-500 hover:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20 transition-colors"
                  onclick={() => openCorrectionModal(c)}
                  title="Koreksi Label"
                >
                  <Tag class="h-4 w-4" />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- 2. Mobile Responsive Cards View (< 768px down to 360px) -->
    <div class="space-y-3 md:hidden">
      {#each comments as c}
        <div class="soft-card p-4 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              {#if c.platform === 'instagram'}
                <InstagramIcon class="h-3.5 w-3.5 text-pink-500" />
              {:else}
                <FacebookIcon class="h-3.5 w-3.5 text-blue-600" />
              {/if}
              <span class="text-xs font-bold text-slate-900 dark:text-white">@{c.authorName}</span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">
              {new Date(c.commentedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <p class="text-xs text-slate-700 dark:text-slate-300">
            {c.text}
          </p>

          <div class="flex flex-wrap items-center gap-1.5">
            {#if c.classification}
              <Badge type="sentiment" value={c.classification.sentiment} />
              {#if c.classification.riskLabel !== 'none'}
                <Badge type="risk" value={c.classification.riskLabel} />
              {/if}
            {/if}
            <Badge type="status" value={c.status} />
          </div>

          {#if c.reply?.finalText}
            <div class="rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span class="font-semibold">Balasan:</span> {c.reply.finalText}
            </div>
          {/if}

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
              onclick={() => openCorrectionModal(c)}
            >
              Koreksi Label
            </button>
            <button
              type="button"
              class="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-brand-500"
              onclick={() => (activeDetailComment = c)}
            >
              Detail
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Comment Detail Modal / Drawer -->
{#if activeDetailComment}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
    <div class="glass-panel w-full max-w-lg p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100/60 dark:border-slate-800/60">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Detail Komentar & Audit</h3>
        <button
          type="button"
          class="rounded-full p-2 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
          onclick={() => (activeDetailComment = null)}
        >
          <X class="h-4.5 w-4.5" />
        </button>
      </div>

      <div class="mt-4 space-y-4 text-xs">
        <div>
          <span class="text-slate-400">Pengirim:</span>
          <p class="font-bold text-sm text-slate-900 dark:text-white">@{activeDetailComment.authorName} ({activeDetailComment.platform})</p>
        </div>

        <div>
          <span class="text-slate-400">Teks Komentar:</span>
          <p class="mt-1 rounded-2xl bg-white/40 p-3.5 font-medium text-slate-900 dark:bg-white/5 dark:text-slate-100 border border-white/60 dark:border-white/10 backdrop-blur-xs">
            "{activeDetailComment.text}"
          </p>
        </div>

        {#if activeDetailComment.post}
          <div>
            <span class="text-slate-400">Post Sumber:</span>
            <p class="mt-1 text-slate-700 dark:text-slate-300">
              {activeDetailComment.post.caption}
            </p>
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-3 pt-2">
          <div>
            <span class="text-slate-400">Klasifikasi Sentimen:</span>
            <div class="mt-1"><Badge type="sentiment" value={activeDetailComment.classification?.sentiment || 'neutral'} /></div>
          </div>
          <div>
            <span class="text-slate-400">Tingkat Risiko:</span>
            <div class="mt-1"><Badge type="risk" value={activeDetailComment.classification?.riskLabel || 'none'} /></div>
          </div>
        </div>

        {#if activeDetailComment.classification?.reason}
          <div>
            <span class="text-slate-400">Alasan Analisis AI:</span>
            <p class="mt-1 text-slate-700 dark:text-slate-300">{activeDetailComment.classification.reason}</p>
          </div>
        {/if}

        {#if activeDetailComment.reply?.finalText}
          <div>
            <span class="text-slate-400">Balasan Terkirim:</span>
            <p class="mt-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-900 dark:text-emerald-200">
              {activeDetailComment.reply.finalText}
            </p>
            <span class="mt-1 block text-[10px] text-slate-400 font-mono">
              Sumber: {activeDetailComment.reply.source} • {new Date(activeDetailComment.reply.sentAt || '').toLocaleString('id-ID')}
            </span>
          </div>
        {/if}
      </div>

      <div class="mt-6 flex justify-end">
        <button
          type="button"
          class="glass-pill px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          onclick={() => (activeDetailComment = null)}
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Label Correction Modal (F13) -->
{#if correctingComment}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
    <div class="glass-panel w-full max-w-md p-6 sm:p-7 shadow-2xl">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Koreksi Label Komentar</h3>
          <p class="text-xs text-slate-500">Koreksi ini digunakan untuk meningkatkan akurasi sistem</p>
        </div>
        <button
          type="button"
          class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          onclick={() => (correctingComment = null)}
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-4 space-y-4">
        <div class="rounded-xl bg-slate-50 p-3 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
          "{correctingComment.text}"
        </div>

        <div>
          <label for="correctSentimentSelect" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Sentimen:</label>
          <select
            id="correctSentimentSelect"
            bind:value={correctSentiment}
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="positive">Positif</option>
            <option value="neutral">Netral</option>
            <option value="negative">Negatif</option>
          </select>
        </div>

        <div>
          <label for="correctRiskSelect" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Label Risiko:</label>
          <select
            id="correctRiskSelect"
            bind:value={correctRisk}
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="none">Aman (None)</option>
            <option value="toxic">Toxic (Kasar)</option>
            <option value="hate">Hate Speech (SARA)</option>
            <option value="threat">Threat (Ancaman)</option>
            <option value="sensitive">Sensitive</option>
            <option value="spam">Spam</option>
          </select>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          class="glass-pill px-4.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          onclick={() => (correctingComment = null)}
        >
          Batal
        </button>
        <button
          type="button"
          class="btn-primary-glass inline-flex items-center rounded-full px-5 py-2 text-xs font-semibold text-white shadow-md active:scale-95 disabled:opacity-50"
          onclick={saveLabelCorrection}
          disabled={isSavingLabel}
        >
          {isSavingLabel ? 'Menyimpan...' : 'Simpan Koreksi'}
        </button>
      </div>
    </div>
  </div>
{/if}
