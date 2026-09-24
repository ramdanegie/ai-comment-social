<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    CheckCircle,
    RotateCcw,
    EyeOff,
    XCircle,
    ShieldAlert,
    Sparkles,
    Keyboard,
    CornerDownLeft,
    Check,
    AlertCircle,
    User,
    Lock
  } from 'lucide-svelte';
  import { api } from '../api';
  import type { CommentItem, UserRole } from '../types';
  import Badge from './Badge.svelte';
  import { toast } from '$lib/toast';

  let {
    workspaceSlug = 'maujahit',
    currentRole = 'owner' as UserRole,
    isLangEn = false,
    onReviewed = () => {}
  }: {
    workspaceSlug?: string;
    currentRole?: UserRole;
    isLangEn?: boolean;
    onReviewed?: () => void;
  } = $props();

  let queue: CommentItem[] = $state([]);
  let loading: boolean = $state(true);
  let processingId: string | null = $state(null);
  let successNotice: string | null = $state(null);
  let editableDrafts: Record<string, string> = $state({});

  async function loadQueue() {
    loading = true;
    try {
      queue = await api.getReviewQueue(workspaceSlug);
      // Initialize draft edits
      const drafts: Record<string, string> = {};
      for (const item of queue) {
        if (item.reply?.draftText) {
          drafts[item.id] = item.reply.draftText;
        } else {
          drafts[item.id] = '';
        }
      }
      editableDrafts = drafts;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
  });

  // Global Keyboard shortcuts: A, R, H, D (disabled while typing in input/textarea)
  function handleKeydown(e: KeyboardEvent) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }
    if (queue.length === 0) return;
    const topItem = queue[0];

    if (e.key.toLowerCase() === 'a') {
      e.preventDefault();
      handleApprove(topItem.id);
    } else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      handleRegenerate(topItem.id);
    } else if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      handleHide(topItem.id);
    } else if (e.key.toLowerCase() === 'd') {
      e.preventDefault();
      handleDismiss(topItem.id);
    }
  }

  async function handleApprove(commentId: string) {
    if (currentRole === 'viewer') {
      toast.error(
        isLangEn ? 'Viewer role is not permitted to approve replies.' : 'Role "Viewer" tidak memiliki izin untuk menyetujui balasan.',
        'Akses Ditolak (HTTP 403)'
      );
      return;
    }
    processingId = commentId;
    const text = editableDrafts[commentId];
    await api.approveReview(workspaceSlug, commentId, text);
    queue = queue.filter((c) => c.id !== commentId);
    processingId = null;
    successNotice = isLangEn ? 'Reply approved and sent!' : 'Balasan disetujui & berhasil dikirim!';
    toast.success(successNotice, isLangEn ? 'Approved' : 'Terkirim');
    setTimeout(() => (successNotice = null), 3000);
    onReviewed();
  }

  async function handleRegenerate(commentId: string) {
    if (currentRole === 'viewer') {
      toast.error(
        isLangEn ? 'Viewer role cannot regenerate drafts.' : 'Role "Viewer" hanya bisa melihat antrean.',
        'Akses Ditolak'
      );
      return;
    }
    processingId = commentId;
    const newText = await api.regenerateReview(workspaceSlug, commentId);
    editableDrafts[commentId] = newText;
    processingId = null;
  }

  async function handleHide(commentId: string) {
    if (currentRole === 'viewer') {
      toast.error(
        isLangEn ? 'Viewer role cannot hide comments.' : 'Role "Viewer" tidak bisa menyembunyikan komentar.',
        'Akses Ditolak'
      );
      return;
    }
    processingId = commentId;
    await api.hideReview(workspaceSlug, commentId);
    queue = queue.filter((c) => c.id !== commentId);
    processingId = null;
    successNotice = isLangEn ? 'Comment hidden on platform' : 'Komentar disembunyikan di platform';
    toast.info(successNotice);
    setTimeout(() => (successNotice = null), 3000);
    onReviewed();
  }

  async function handleDismiss(commentId: string) {
    processingId = commentId;
    await api.dismissReview(workspaceSlug, commentId);
    queue = queue.filter((c) => c.id !== commentId);
    processingId = null;
    onReviewed();
  }
</script>

<div class="space-y-6">
  <!-- Header & Instructions -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          {isLangEn ? 'Moderation Review Queue' : 'Antrean Review Moderasi'}
        </h1>
        <span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {queue.length} Pending
        </span>
      </div>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Comments held for human verification (Toxic, Complaints, Threats, or Low Confidence)'
          : 'Komentar yang ditahan AI untuk keputusan manusia (Toxic, Keluhan, Ancaman, atau Akun Shadow)'}
      </p>
    </div>

    <!-- Keyboard Shortcuts Legend -->
    <div class="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 md:flex">
      <Keyboard class="h-4 w-4 text-slate-400" />
      <span class="font-medium">Shortcut:</span>
      <span class="inline-flex items-center gap-1 font-mono"><kbd class="rounded bg-slate-100 px-1.5 py-0.5 border text-[11px] dark:bg-slate-800">A</kbd> Approve</span>
      <span class="inline-flex items-center gap-1 font-mono"><kbd class="rounded bg-slate-100 px-1.5 py-0.5 border text-[11px] dark:bg-slate-800">R</kbd> Regenerate</span>
      <span class="inline-flex items-center gap-1 font-mono"><kbd class="rounded bg-slate-100 px-1.5 py-0.5 border text-[11px] dark:bg-slate-800">H</kbd> Hide</span>
      <span class="inline-flex items-center gap-1 font-mono"><kbd class="rounded bg-slate-100 px-1.5 py-0.5 border text-[11px] dark:bg-slate-800">D</kbd> Dismiss</span>
    </div>
  </div>

  <!-- Role Warning if Viewer -->
  {#if currentRole === 'viewer'}
    <div class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
      <Lock class="h-4 w-4 shrink-0 text-amber-600" />
      <span>
        <strong>Mode Viewer:</strong> Anda sedang dalam mode peninjau hanya-baca. Aksi persetujuan dan moderasi dinonaktifkan untuk role ini. Ubah role di menu navigasi atas untuk menguji aksi admin/owner.
      </span>
    </div>
  {/if}

  <!-- Success Toast -->
  {#if successNotice}
    <div class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 animate-in fade-in slide-in-from-top-2">
      <CheckCircle class="h-4 w-4 text-emerald-600" />
      <span>{successNotice}</span>
    </div>
  {/if}

  <!-- Queue Cards List -->
  {#if loading}
    <div class="space-y-4">
      {#each [1, 2] as _}
        <div class="h-56 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
      {/each}
    </div>
  {:else if queue.length === 0}
    <!-- Empty State -->
    <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center dark:border-slate-800 dark:bg-slate-900">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
        <CheckCircle class="h-8 w-8" />
      </div>
      <h3 class="mt-4 text-base font-bold text-slate-900 dark:text-white">
        {isLangEn ? 'All Caught Up!' : 'Semua Komentar Selesai Ditinjau!'}
      </h3>
      <p class="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
        {isLangEn
          ? 'No pending reviews right now. AI will alert you when risky comments or new customer queries arrive.'
          : 'Tidak ada komentar tertahan saat ini. AI akan segera menotifikasi Anda jika ada komentar berisiko atau pertanyaan baru.'}
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each queue as item (item.id)}
        {@const isHighRisk = ['threat', 'hate', 'toxic'].includes(item.classification?.riskLabel || '')}
        <div
          class="rounded-2xl border transition-all duration-200 soft-card-hover {isHighRisk
            ? 'border-[#ea4335]/30 bg-[#ea4335]/[0.02] shadow-[0_2px_12px_rgba(234,67,53,0.08)] dark:border-[#ea4335]/25 dark:bg-[#ea4335]/10'
            : 'soft-card'}"
        >
          <div class="p-5 sm:p-6 space-y-4">
            <!-- Top Card Header: Author, Platform, Time, Badges -->
            <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold text-slate-900 dark:text-white">@{item.authorName}</span>
                <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300 uppercase">
                  {item.platform}
                </span>
                <span class="text-xs text-slate-400 font-mono">
                  {new Date(item.commentedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <!-- AI Classification tags -->
              <div class="flex flex-wrap items-center gap-1.5">
                {#if item.classification}
                  <Badge type="sentiment" value={item.classification.sentiment} />
                  <Badge type="intent" value={item.classification.intent} />
                  {#if item.classification.riskLabel !== 'none'}
                    <Badge type="risk" value={item.classification.riskLabel} />
                  {/if}
                  <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300" title="Tingkat keyakinan AI">
                    {Math.round(item.classification.confidence * 100)}% conf
                  </span>
                {/if}
              </div>
            </div>

            <!-- Post Context Snippet (if available) -->
            {#if item.post}
              <div class="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
                {#if item.post.mediaUrl}
                  <img src={item.post.mediaUrl} alt="Post" class="h-9 w-9 shrink-0 rounded-lg object-cover" />
                {/if}
                <div class="min-w-0 flex-1 truncate">
                  <span class="font-semibold text-slate-700 dark:text-slate-300">Konteks Post:</span> {item.post.caption}
                </div>
              </div>
            {/if}

            <!-- Comment Text -->
            <div class="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 dark:border-slate-800/80 dark:bg-slate-800/40">
              <p class="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                "{item.text}"
              </p>
            </div>

            <!-- AI Reason Explanation -->
            {#if item.classification?.reason}
              <div class="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <AlertCircle class="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span><strong class="text-slate-700 dark:text-slate-300">Alasan Ditahan:</strong> {item.classification.reason}</span>
              </div>
            {/if}

            <!-- Draft Response Textarea (Editable) -->
            <div class="space-y-1.5 pt-2">
              <div class="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>{isLangEn ? 'AI Draft Response (Editable):' : 'Draft Balasan AI (Bisa Diedit):'}</span>
                {#if item.classification?.riskLabel === 'threat' || item.classification?.riskLabel === 'hate'}
                  <span class="flex items-center gap-1 text-[#ea4335] dark:text-red-400 font-bold text-[11px]">
                    <ShieldAlert class="h-3.5 w-3.5 shrink-0" />
                    <span>Kategori Berisiko Tinggi: Tindakan manual diperlukan</span>
                  </span>
                {/if}
              </div>
              <textarea
                rows="2"
                bind:value={editableDrafts[item.id]}
                placeholder={isLangEn ? 'Type reply or leave blank...' : 'Tulis balasan atau gunakan rekomendasi AI...'}
                class="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 transition focus:border-[#ea4335] focus:ring-2 focus:ring-[#ea4335]/20 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-2xs"
              ></textarea>
            </div>

            <!-- Action Buttons Grid (PRD §5.1 FR-6: Approve / Edit / Regenerate / Hide / Dismiss) -->
            <div class="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <!-- Left side actions: Hide / Dismiss -->
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 sm:min-h-[36px] sm:py-2 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 shadow-2xs"
                  onclick={() => handleDismiss(item.id)}
                  title="Tutup antrean tanpa tindakan (D)"
                >
                  <XCircle class="h-3.5 w-3.5" />
                  <span>{isLangEn ? 'Dismiss [D]' : 'Tutup [D]'}</span>
                </button>

                <button
                  type="button"
                  class="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-semibold text-[#ea4335] transition-all hover:bg-[#ea4335]/10 active:scale-95 sm:min-h-[36px] sm:py-2 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-red-400 dark:hover:bg-[#ea4335]/20 shadow-2xs"
                  onclick={() => handleHide(item.id)}
                  title="Sembunyikan komentar di Instagram/Facebook (H)"
                >
                  <EyeOff class="h-3.5 w-3.5" />
                  <span>{isLangEn ? 'Hide [H]' : 'Sembunyikan [H]'}</span>
                </button>
              </div>

              <!-- Right side actions: Regenerate & Approve -->
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 active:scale-95 sm:min-h-[36px] sm:py-2 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800 shadow-2xs"
                  onclick={() => handleRegenerate(item.id)}
                  disabled={processingId === item.id}
                  title="Generate variasi balasan baru (R)"
                >
                  <RotateCcw class="h-3.5 w-3.5 {processingId === item.id ? 'animate-spin' : ''}" />
                  <span>{isLangEn ? 'Regenerate [R]' : 'Generate Ulang [R]'}</span>
                </button>

                <button
                  type="button"
                  class="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#ea4335] px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#ea4335]/25 transition-all hover:bg-[#d93025] hover:shadow-[#ea4335]/35 hover:scale-[1.01] active:scale-98 disabled:opacity-50 sm:min-h-[36px] sm:py-2"
                  onclick={() => handleApprove(item.id)}
                  disabled={processingId === item.id}
                  title="Setujui dan kirim balasan ke platform (A)"
                >
                  <Check class="h-4 w-4" />
                  <span>{isLangEn ? 'Approve & Send [A]' : 'Setujui & Kirim [A]'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
