<script lang="ts">
  import type { Sentiment, RiskLabel, Intent, CommentStatus } from '../types';

  let {
    type,
    value,
    size = 'sm'
  }: {
    type: 'sentiment' | 'risk' | 'intent' | 'status';
    value: string;
    size?: 'sm' | 'md';
  } = $props();

  const sentimentStyles: Record<Sentiment, { bg: string; text: string; border: string; label: string }> = {
    positive: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/20 dark:border-emerald-500/30', label: 'Positif' },
    neutral: { bg: 'bg-slate-500/10 dark:bg-slate-400/15', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/20 dark:border-slate-500/25', label: 'Netral' },
    negative: { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/20 dark:border-amber-500/30', label: 'Negatif' }
  };

  const riskStyles: Record<RiskLabel, { bg: string; text: string; border: string; label: string }> = {
    none: { bg: 'bg-slate-500/10 dark:bg-slate-800/60', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200/80 dark:border-slate-700/60', label: 'Aman' },
    spam: { bg: 'bg-violet-500/10 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500/20 dark:border-violet-500/30', label: 'Spam' },
    toxic: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/20 dark:border-rose-500/30', label: 'Kasar' },
    hate: { bg: 'bg-rose-500/15 dark:bg-rose-500/25', text: 'text-rose-700 dark:text-rose-200 font-semibold', border: 'border-rose-500/30 dark:border-rose-500/40', label: 'SARA / Kebencian' },
    threat: { bg: 'bg-rose-500/20 dark:bg-rose-500/30', text: 'text-rose-700 dark:text-rose-200 font-bold', border: 'border-rose-500/40 dark:border-rose-500/50', label: 'Ancaman' },
    sensitive: { bg: 'bg-orange-500/10 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/20 dark:border-orange-500/30', label: 'Sensitif' }
  };

  const intentLabels: Record<Intent, string> = {
    praise: 'Pujian',
    purchase_intent: 'Minat Beli',
    question: 'Pertanyaan',
    complaint: 'Keluhan',
    other: 'Lainnya'
  };

  const statusStyles: Record<CommentStatus, { bg: string; text: string; border: string; label: string }> = {
    RECEIVED: { bg: 'bg-slate-500/10 dark:bg-slate-500/15', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20 dark:border-slate-500/30', label: 'Diterima' },
    CLASSIFIED: { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/20 dark:border-sky-500/30', label: 'Terklasifikasi' },
    AUTO_REPLY_QUEUED: { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/20 dark:border-sky-500/30', label: 'Akan dibalas' },
    NEEDS_REVIEW: { bg: 'bg-amber-500/15 dark:bg-amber-500/20', text: 'text-amber-800 dark:text-amber-200 font-semibold', border: 'border-amber-500/30 dark:border-amber-500/40', label: 'Perlu Review' },
    APPROVED: { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/20 dark:border-sky-500/30', label: 'Sedang dikirim' },
    REPLIED: { bg: 'bg-emerald-500/15 dark:bg-emerald-500/20', text: 'text-emerald-800 dark:text-emerald-200 font-medium', border: 'border-emerald-500/30 dark:border-emerald-500/40', label: 'Terbalas' },
    HIDDEN: { bg: 'bg-slate-500/10 dark:bg-slate-500/15', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20 dark:border-slate-500/30', label: 'Disembunyikan' },
    DISMISSED: { bg: 'bg-slate-500/10 dark:bg-slate-500/15', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-500/20 dark:border-slate-500/30', label: 'Ditutup' },
    IGNORED: { bg: 'bg-slate-500/10 dark:bg-slate-500/15', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-500/20 dark:border-slate-500/30', label: 'Diabaikan' },
    FAILED: { bg: 'bg-rose-500/15 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-200', border: 'border-rose-500/30 dark:border-rose-500/40', label: 'Gagal Kirim' }
  };

  let styling = $derived(
    type === 'sentiment'
      ? sentimentStyles[value as Sentiment] || { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-500/20', label: value }
      : type === 'risk'
        ? riskStyles[value as RiskLabel] || { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-500/20', label: value }
        : type === 'status'
          ? statusStyles[value as CommentStatus] || { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-500/20', label: value }
          : { bg: 'bg-blue-500/10 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/20 dark:border-blue-500/30', label: intentLabels[value as Intent] || value }
  );
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 tracking-wide transition-all {styling.bg} {styling.text} {styling.border} {size === 'sm' ? 'text-[11px]' : 'text-xs'}"
>
  {#if type === 'risk' && value !== 'none'}
    <span class="inline-block h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
  {:else if type === 'sentiment' && value === 'positive'}
    <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
  {:else if type === 'status' && value === 'NEEDS_REVIEW'}
    <span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"></span>
  {:else if type === 'status' && value === 'REPLIED'}
    <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
  {/if}
  <span>{styling.label}</span>
</span>
