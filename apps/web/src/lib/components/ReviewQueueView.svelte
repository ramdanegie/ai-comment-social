<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    CheckCircle,
    RotateCcw,
    EyeOff,
    X,
    ShieldAlert,
    Send,
    AlertCircle,
    Lock,
    ArrowLeft,
    ExternalLink,
    Keyboard
  } from 'lucide-svelte';
  import { api } from '../api';
  import type { CommentItem, UserRole } from '../types';
  import Badge from './Badge.svelte';
  import InstagramIcon from './icons/InstagramIcon.svelte';
  import FacebookIcon from './icons/FacebookIcon.svelte';
  import TiktokIcon from './icons/TiktokIcon.svelte';
  import { toast } from '$lib/toast';
  import { timeAgo } from '$lib/format';

  let {
    workspaceSlug = '',
    currentRole = 'owner' as UserRole,
    isLangEn = false,
    onReviewed = () => {}
  }: {
    workspaceSlug?: string;
    currentRole?: UserRole;
    isLangEn?: boolean;
    onReviewed?: () => void;
  } = $props();

  const HIGH_RISK = ['threat', 'hate', 'toxic'];
  const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

  const AVATAR_TONES = [
    'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
  ];
  /** Stable pastel tone per author so the list is easy to scan. */
  function avatarTone(name: string) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
  }

  let queue: CommentItem[] = $state([]);
  let loading = $state(true);
  let processingId = $state<string | null>(null);
  let drafts: Record<string, string> = $state({});
  let selectedId = $state<string | null>(null);
  /** Mobile: list ↔ detail. Desktop shows both. */
  let mobileShowDetail = $state(false);

  let selected = $derived(queue.find((c) => c.id === selectedId) ?? null);
  let isHighRisk = $derived(HIGH_RISK.includes(selected?.classification?.riskLabel ?? ''));
  let canAct = $derived(currentRole !== 'viewer');
  let draftText = $derived(selected ? (drafts[selected.id] ?? '') : '');

  async function loadQueue() {
    loading = true;
    try {
      queue = await api.getReviewQueue(workspaceSlug);
      drafts = Object.fromEntries(queue.map((c) => [c.id, c.reply?.draftText ?? '']));
      selectedId = queue[0]?.id ?? null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadQueue();
    window.addEventListener('keydown', handleKeydown);
  });
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeydown);
  });

  function select(id: string) {
    selectedId = id;
    mobileShowDetail = true;
  }

  function move(delta: number) {
    if (!queue.length) return;
    const i = Math.max(0, queue.findIndex((c) => c.id === selectedId));
    const next = queue[Math.min(queue.length - 1, Math.max(0, i + delta))];
    selectedId = next.id;
    document.getElementById(`rq-${next.id}`)?.scrollIntoView({ block: 'nearest' });
  }

  /** Remove the handled item and focus the next one so the admin can keep going. */
  function removeAndAdvance(id: string) {
    const i = queue.findIndex((c) => c.id === id);
    queue = queue.filter((c) => c.id !== id);
    selectedId = queue[Math.min(i, queue.length - 1)]?.id ?? null;
    if (!selectedId) mobileShowDetail = false;
    onReviewed();
  }

  // Shortcuts act on the selected comment (PRD §10 / §18.2-6). Disabled while typing.
  function handleKeydown(e: KeyboardEvent) {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
      if (e.key === 'Escape') (el as HTMLElement).blur();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || !selected) return;

    const key = e.key.toLowerCase();
    const actions: Record<string, () => void> = {
      j: () => move(1),
      arrowdown: () => move(1),
      k: () => move(-1),
      arrowup: () => move(-1),
      a: () => handleApprove(),
      e: () => document.getElementById('rq-draft')?.focus(),
      r: () => handleRegenerate(),
      h: () => handleHide(),
      d: () => handleDismiss()
    };
    if (actions[key]) {
      e.preventDefault();
      actions[key]();
    }
  }

  function denyViewer() {
    toast.error(
      isLangEn ? 'Viewer role can only read the queue.' : 'Role Viewer hanya bisa melihat antrean.',
      isLangEn ? 'Access denied' : 'Akses ditolak'
    );
  }

  async function run(action: () => Promise<void>) {
    if (!selected || processingId) return;
    if (!canAct) return denyViewer();
    processingId = selected.id;
    try {
      await action();
    } catch (err) {
      toast.error((err as Error).message || 'Terjadi kesalahan', isLangEn ? 'Failed' : 'Gagal');
    } finally {
      processingId = null;
    }
  }

  const handleApprove = () =>
    run(async () => {
      const item = selected!;
      const text = (drafts[item.id] ?? '').trim();
      if (!text) {
        toast.warning(isLangEn ? 'Write a reply first.' : 'Tulis balasan dulu sebelum mengirim.');
        document.getElementById('rq-draft')?.focus();
        return;
      }
      await api.approveReview(workspaceSlug, item.id, text);
      toast.success(
        isLangEn
          ? `Reply is being sent to ${PLATFORM_LABEL[item.platform]}.`
          : `Balasan sedang dikirim ke ${PLATFORM_LABEL[item.platform]}.`,
        isLangEn ? 'Approved' : 'Disetujui'
      );
      removeAndAdvance(item.id);
    });

  const handleRegenerate = () =>
    run(async () => {
      const id = selected!.id;
      drafts[id] = await api.regenerateReview(workspaceSlug, id);
    });

  const handleHide = () =>
    run(async () => {
      const item = selected!;
      await api.hideReview(workspaceSlug, item.id);
      toast.info(
        isLangEn
          ? `Comment will be hidden on ${PLATFORM_LABEL[item.platform]}.`
          : `Komentar akan disembunyikan di ${PLATFORM_LABEL[item.platform]}.`
      );
      removeAndAdvance(item.id);
    });

  const handleDismiss = () =>
    run(async () => {
      const id = selected!.id;
      await api.dismissReview(workspaceSlug, id);
      removeAndAdvance(id);
    });
</script>

{#snippet platformIcon(platform: string, cls = 'h-3.5 w-3.5')}
  {#if platform === 'instagram'}
    <InstagramIcon class={cls} />
  {:else if platform === 'facebook'}
    <FacebookIcon class={cls} />
  {:else}
    <TiktokIcon class={cls} />
  {/if}
{/snippet}

{#snippet avatar(name: string, size = 'h-9 w-9 text-sm')}
  <span class="flex shrink-0 items-center justify-center rounded-full font-semibold uppercase {size} {avatarTone(name)}">
    {name.replace(/[^a-z0-9]/gi, '').charAt(0) || '?'}
  </span>
{/snippet}

{#snippet kbd(k: string)}
  <kbd class="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{k}</kbd>
{/snippet}

<div class="space-y-5">
  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {isLangEn ? 'Review queue' : 'Antrean Review'}
      </h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {#if loading}
          &nbsp;
        {:else if queue.length}
          {queue.length} {isLangEn ? 'comments need a decision' : 'komentar menunggu keputusanmu'} ·
          {isLangEn ? 'highest risk first' : 'risiko tertinggi di atas'}
        {:else}
          {isLangEn ? 'Nothing waiting' : 'Tidak ada yang menunggu'}
        {/if}
      </p>
    </div>
    <div class="hidden items-center gap-3 text-xs text-slate-500 dark:text-slate-400 lg:flex">
      <Keyboard class="h-4 w-4 text-slate-400" />
      <span class="flex items-center gap-1">{@render kbd('J')}{@render kbd('K')} {isLangEn ? 'move' : 'pindah'}</span>
      <span class="flex items-center gap-1">{@render kbd('E')} edit</span>
      <span class="flex items-center gap-1">{@render kbd('A')} {isLangEn ? 'send' : 'kirim'}</span>
      <span class="flex items-center gap-1">{@render kbd('H')} {isLangEn ? 'hide' : 'sembunyikan'}</span>
      <span class="flex items-center gap-1">{@render kbd('D')} {isLangEn ? 'close' : 'tutup'}</span>
    </div>
  </div>

  {#if !canAct}
    <div class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
      <Lock class="h-4 w-4 shrink-0" />
      {isLangEn
        ? 'Read-only: the Viewer role cannot send, hide, or close comments.'
        : 'Hanya-baca: role Viewer tidak bisa mengirim, menyembunyikan, atau menutup komentar.'}
    </div>
  {/if}

  {#if loading}
    <div class="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div class="space-y-2">
        {#each [1, 2, 3, 4] as _}
          <div class="h-20 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800"></div>
        {/each}
      </div>
      <div class="hidden h-96 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800 lg:block"></div>
    </div>
  {:else if queue.length === 0}
    <div class="soft-card flex flex-col items-center justify-center px-4 py-16 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/25">
        <CheckCircle class="h-6 w-6" />
      </div>
      <h3 class="mt-4 text-base font-semibold text-slate-900 dark:text-white">
        {isLangEn ? 'All caught up' : 'Semua sudah ditinjau'}
      </h3>
      <p class="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {isLangEn
          ? 'Risky comments and questions the AI is unsure about will show up here.'
          : 'Komentar berisiko dan pertanyaan yang AI ragu menjawab akan muncul di sini.'}
      </p>
    </div>
  {:else}
    <div class="grid gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
      <!-- List -->
      <ul
        class="soft-card space-y-1 p-2 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto {mobileShowDetail ? 'hidden lg:block' : ''}"
        aria-label={isLangEn ? 'Comments to review' : 'Komentar untuk ditinjau'}
      >
        {#each queue as item (item.id)}
          {@const risky = HIGH_RISK.includes(item.classification?.riskLabel ?? '')}
          {@const active = item.id === selectedId}
          <li id="rq-{item.id}">
            <button
              type="button"
              onclick={() => select(item.id)}
              aria-current={active}
              class="flex w-full gap-3 rounded-xl px-3 py-3 text-left transition {active
                ? 'bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}"
            >
              {@render avatar(item.authorName)}
              <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-1.5 text-xs">
                <span class="truncate font-semibold text-slate-900 dark:text-white">@{item.authorName}</span>
                {#if risky}<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true"></span>{/if}
                <span class="ml-auto flex shrink-0 items-center gap-1 text-slate-400">
                  {@render platformIcon(item.platform, 'h-3 w-3')}
                  {timeAgo(item.commentedAt, isLangEn)}
                </span>
              </div>
              <p class="line-clamp-2 text-sm leading-snug text-slate-600 dark:text-slate-300">{item.text}</p>
              <div class="flex flex-wrap gap-1 pt-0.5">
                {#if item.classification}
                  {#if item.classification.riskLabel !== 'none'}
                    <Badge type="risk" value={item.classification.riskLabel} />
                  {:else}
                    <Badge type="intent" value={item.classification.intent} />
                  {/if}
                {/if}
                {#if risky}
                  <span class="sr-only">{isLangEn ? 'high risk' : 'risiko tinggi'}</span>
                {/if}
              </div>
              </div>
            </button>
          </li>
        {/each}
      </ul>

      <!-- Detail -->
      {#if selected}
        {@const cls = selected.classification}
        <section
          class="soft-card p-0 lg:overflow-hidden {mobileShowDetail ? '' : 'hidden lg:block'}"
          aria-label={isLangEn ? 'Comment detail' : 'Detail komentar'}
        >
          <div class="space-y-5 p-5 sm:p-6">
            <button
              type="button"
              class="-ml-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white lg:hidden"
              onclick={() => (mobileShowDetail = false)}
            >
              <ArrowLeft class="h-4 w-4" />
              {isLangEn ? 'Back to list' : 'Kembali ke daftar'}
            </button>

            <!-- Author + meta -->
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                {@render avatar(selected.authorName, 'h-11 w-11 text-base')}
                <div class="min-w-0">
                <p class="truncate text-base font-semibold text-slate-900 dark:text-white">@{selected.authorName}</p>
                <p class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  {@render platformIcon(selected.platform)}
                  {PLATFORM_LABEL[selected.platform]}
                  {#if selected.account?.username}· {selected.account.username}{/if}
                  · {new Date(selected.commentedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                </div>
              </div>
              {#if cls}
                <div class="flex flex-wrap items-center gap-1.5">
                  <Badge type="sentiment" value={cls.sentiment} />
                  <Badge type="intent" value={cls.intent} />
                  {#if cls.riskLabel !== 'none'}<Badge type="risk" value={cls.riskLabel} />{/if}
                  <span
                    class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300"
                    title={isLangEn ? 'AI confidence' : 'Keyakinan AI'}
                  >
                    {isLangEn ? 'Confidence' : 'Keyakinan'} {Math.round(cls.confidence * 100)}%
                  </span>
                </div>
              {/if}
            </div>

            <!-- The comment -->
            <blockquote class="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              {selected.text}
            </blockquote>

            <!-- Why held -->
            {#if cls?.reason}
              <div
                class="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm {isHighRisk
                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                  : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}"
              >
                {#if isHighRisk}
                  <ShieldAlert class="mt-0.5 h-4 w-4 shrink-0" />
                {:else}
                  <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
                {/if}
                <span>
                  <strong class="font-semibold">{isLangEn ? 'Why it was held:' : 'Kenapa ditahan:'}</strong>
                  {cls.reason}
                  {#if isHighRisk}
                    <br /><span class="text-xs opacity-80">
                      {isLangEn
                        ? 'High-risk comments are never answered automatically. Hiding is usually the safest choice.'
                        : 'Komentar berisiko tinggi tidak pernah dibalas otomatis. Menyembunyikan biasanya pilihan paling aman.'}
                    </span>
                  {/if}
                </span>
              </div>
            {/if}

            <!-- Post context -->
            {#if selected.post}
              <div class="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 pr-3.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {#if selected.post.mediaUrl}
                  <img src={selected.post.mediaUrl} alt="" class="h-12 w-12 shrink-0 rounded-lg object-cover" />
                {/if}
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-slate-700 dark:text-slate-300">{isLangEn ? 'Commented on post' : 'Komentar di post'}</p>
                  <p class="mt-0.5 line-clamp-2 {selected.post.caption ? '' : 'italic text-slate-400'}">
                    {selected.post.caption || (isLangEn ? 'No caption' : 'Tanpa caption')}
                  </p>
                </div>
                {#if selected.post.permalink}
                  <a
                    href={selected.post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex shrink-0 items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {isLangEn ? 'Open' : 'Buka'} <ExternalLink class="h-3 w-3" />
                  </a>
                {/if}
              </div>
            {/if}

            <!-- Draft -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label for="rq-draft" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isLangEn ? 'Reply' : 'Balasan'}
                  {#if selected.reply?.draftText}
                    <span class="font-normal text-slate-400">· {isLangEn ? 'AI draft, editable' : 'draft AI, bisa diedit'}</span>
                  {/if}
                </label>
                <span class="font-mono text-[11px] text-slate-400">{draftText.length}</span>
              </div>
              <textarea
                id="rq-draft"
                rows="4"
                bind:value={drafts[selected.id]}
                disabled={!canAct}
                placeholder={isHighRisk
                  ? isLangEn
                    ? 'No AI draft for high-risk comments. Write one only if a reply is really needed.'
                    : 'AI tidak membuat draft untuk komentar berisiko. Tulis sendiri hanya jika memang perlu dibalas.'
                  : isLangEn
                    ? 'Write a reply…'
                    : 'Tulis balasan…'}
                class="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              ></textarea>
            </div>
          </div>

          <!-- Actions -->
          <div class="review-actions sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/95 px-5 py-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6 lg:static lg:bg-slate-50/60 lg:backdrop-blur-none">
            <button
              type="button"
              onclick={handleDismiss}
              disabled={!canAct || !!processingId}
              title={isLangEn ? 'Close without action (D)' : 'Tutup tanpa tindakan (D)'}
              class="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X class="h-4 w-4" />
              {isLangEn ? 'Close' : 'Tutup'}
            </button>

            <div class="ml-auto flex flex-wrap items-center gap-2">
              {#if !isHighRisk}
                <button
                  type="button"
                  onclick={handleRegenerate}
                  disabled={!canAct || !!processingId}
                  title={isLangEn ? 'New AI draft (R)' : 'Draft AI baru (R)'}
                  class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RotateCcw class="h-4 w-4 {processingId === selected.id ? 'animate-spin' : ''}" />
                  {isLangEn ? 'Regenerate' : 'Buat ulang'}
                </button>
              {/if}

              <button
                type="button"
                onclick={handleHide}
                disabled={!canAct || !!processingId}
                title={isLangEn ? 'Hide on the platform (H)' : 'Sembunyikan di platform (H)'}
                class="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-40 {isHighRisk
                  ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-700'
                  : 'border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400'}"
              >
                <EyeOff class="h-4 w-4" />
                {isLangEn ? 'Hide' : 'Sembunyikan'}
              </button>

              <button
                type="button"
                onclick={handleApprove}
                disabled={!canAct || !!processingId || !draftText.trim()}
                title={isLangEn ? 'Send reply (A)' : 'Kirim balasan (A)'}
                class="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 {isHighRisk
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  : 'bg-brand-600 text-white shadow-sm hover:bg-brand-700'}"
              >
                <Send class="h-4 w-4" />
                {isLangEn ? 'Send reply' : 'Kirim balasan'}
              </button>
            </div>
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>
