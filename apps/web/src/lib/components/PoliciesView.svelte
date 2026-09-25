<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Sliders,
    Bot,
    Wand2,
    CheckCircle2,
    Shield,
    AlertTriangle,
    Play,
    Plus,
    X,
    MessageSquare,
    Save
  } from 'lucide-svelte';
  import { api } from '../api';
  import type { ReplyPolicy, SocialAccount, Intent, PolicyMode } from '../types';
  import Badge from './Badge.svelte';
  import { toast } from '$lib/toast';

  let {
    workspaceSlug = 'maujahit',
    isLangEn = false
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
  } = $props();

  let accounts: SocialAccount[] = $state([]);
  let selectedAccountId: string = $state('');
  let policy: ReplyPolicy = $state({
    socialAccountId: '',
    mode: 'assisted',
    autoReplyIntents: ['praise', 'purchase_intent'],
    minConfidence: 0.8,
    dailyAutoReplyLimit: 200,
    minIntervalSeconds: 20,
    activeHours: { start: '08:00', end: '22:00', tz: 'Asia/Jakarta' },
    brandVoice: {
      brandName: 'MauJahit.id',
      tone: 'Ramah, bersahabat, profesional, khas UMKM fashion Indonesia',
      useEmoji: true,
      cta: 'Silakan DM kami ya kak atau hubungi nomor layanan kami.',
      forbiddenPhrases: ['pasti gratis', 'bisa beres 1 jam', 'garansi 100% uang kembali']
    },
    customBlockedKeywords: ['slot', 'gacor', 'judi', 'penipu', 'bodong'],
    autoHideSpam: true
  });

  let loading: boolean = $state(true);
  let isSaving: boolean = $state(false);
  let saveSuccess: boolean = $state(false);

  // New forbidden phrase input
  let newForbiddenPhrase: string = $state('');
  let newBlockedKeyword: string = $state('');

  // Interactive Live Preview Tester
  let sampleCommentInput: string = $state('Bisa bikin jas semi-formal warna navy ukuran custom nggak kak? Estimasi berapa lama?');
  let sampleAuthorInput: string = $state('Rian Nugraha');
  let isTestingPreview: boolean = $state(false);
  let previewResult: any = $state(null);

  async function loadData() {
    loading = true;
    try {
      accounts = await api.getAccounts(workspaceSlug);
      if (accounts.length > 0) {
        selectedAccountId = accounts[0].id;
        if (accounts[0].policy) {
          policy = JSON.parse(JSON.stringify(accounts[0].policy));
        }
      }
    } finally {
      loading = false;
    }
  }

  onMount(loadData);

  function handleAccountChange() {
    const acc = accounts.find((a) => a.id === selectedAccountId);
    if (acc?.policy) {
      policy = JSON.parse(JSON.stringify(acc.policy));
    }
  }

  function toggleIntent(intent: Intent) {
    if (policy.autoReplyIntents.includes(intent)) {
      policy.autoReplyIntents = policy.autoReplyIntents.filter((i) => i !== intent);
    } else {
      policy.autoReplyIntents = [...policy.autoReplyIntents, intent];
    }
  }

  function addForbiddenPhrase() {
    if (newForbiddenPhrase.trim() && !policy.brandVoice.forbiddenPhrases.includes(newForbiddenPhrase.trim())) {
      policy.brandVoice.forbiddenPhrases = [...policy.brandVoice.forbiddenPhrases, newForbiddenPhrase.trim()];
      newForbiddenPhrase = '';
    }
  }

  function removeForbiddenPhrase(phrase: string) {
    policy.brandVoice.forbiddenPhrases = policy.brandVoice.forbiddenPhrases.filter((p) => p !== phrase);
  }

  function addBlockedKeyword() {
    if (newBlockedKeyword.trim() && !policy.customBlockedKeywords.includes(newBlockedKeyword.trim())) {
      policy.customBlockedKeywords = [...policy.customBlockedKeywords, newBlockedKeyword.trim()];
      newBlockedKeyword = '';
    }
  }

  function removeBlockedKeyword(kw: string) {
    policy.customBlockedKeywords = policy.customBlockedKeywords.filter((k) => k !== kw);
  }

  async function handleSavePolicy() {
    isSaving = true;
    try {
      await api.updatePolicy(workspaceSlug, selectedAccountId, policy);
      saveSuccess = true;
      toast.success(
        isLangEn ? 'Policy and brand voice saved!' : 'Aturan dan Brand Voice berhasil disimpan!',
        isLangEn ? 'Saved' : 'Tersimpan'
      );
      setTimeout(() => (saveSuccess = false), 3000);
    } finally {
      isSaving = false;
    }
  }

  async function handleRunPreview() {
    if (!sampleCommentInput.trim()) return;
    isTestingPreview = true;
    try {
      previewResult = await api.previewPolicy(workspaceSlug, selectedAccountId, {
        sampleComment: sampleCommentInput,
        sampleAuthor: sampleAuthorInput,
        mode: policy.mode,
        autoReplyIntents: policy.autoReplyIntents,
        minConfidence: policy.minConfidence,
        brandVoice: policy.brandVoice,
        customBlockedKeywords: policy.customBlockedKeywords,
        autoHideSpam: policy.autoHideSpam
      });
    } finally {
      isTestingPreview = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {isLangEn ? 'Reply Policies & Brand Voice' : 'Aturan Balasan & Brand Voice'}
      </h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Configure autonomous AI behavior, safety thresholds, and brand voice guidelines'
          : 'Konfigurasi mode AI, batasan risiko aman, dan gaya bahasa MauJahit.id'}
      </p>
    </div>

    <!-- Account Switcher & Save Button -->
    <div class="flex items-center gap-3">
      <select
        bind:value={selectedAccountId}
        onchange={handleAccountChange}
        class="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      >
        {#each accounts as acc}
          <option value={acc.id}>{acc.username} ({acc.platform})</option>
        {/each}
      </select>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
        onclick={handleSavePolicy}
        disabled={isSaving}
      >
        <Save class="h-4 w-4" />
        <span>{isSaving ? 'Menyimpan...' : 'Simpan Aturan'}</span>
      </button>
    </div>
  </div>

  {#if saveSuccess}
    <div class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 animate-in fade-in">
      <CheckCircle2 class="h-4 w-4 text-emerald-600" />
      <span>Aturan dan Brand Voice berhasil disimpan!</span>
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Left 2 Cols: Main Policy Controls -->
    <div class="space-y-6 lg:col-span-2">
      <!-- 1. Policy Mode Selector (Shadow / Assisted / Auto) -->
      <div class="soft-card p-5.5">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">
          Mode Otomasi Akun
        </h2>
        <p class="mt-1 text-xs text-slate-500">
          Tentukan tingkat kemandirian AI saat merespon komentar baru.
        </p>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <!-- Shadow Mode -->
          <label
            class="flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition {policy.mode === 'shadow'
              ? 'border-[#f9ab00] bg-[#f9ab00]/5 dark:border-[#f9ab00] dark:bg-[#f9ab00]/15'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'}"
          >
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-white">Shadow Mode</span>
                <input type="radio" name="mode" value="shadow" bind:group={policy.mode} class="text-[#f9ab00] focus:ring-[#f9ab00]" />
              </div>
              <p class="mt-1.5 text-[11px] text-slate-500 leading-normal">
                AI mengklasifikasi & membuat draft, tapi <strong>tidak pernah mengirim</strong> apa pun. Cocok untuk kalibrasi awal.
              </p>
            </div>
            <span class="mt-3 inline-block text-[10px] font-semibold text-amber-600 dark:text-amber-400">Default Trial</span>
          </label>

          <!-- Assisted Mode -->
          <label
            class="flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition {policy.mode === 'assisted'
              ? 'border-[#1e8e3e] bg-[#1e8e3e]/5 dark:border-[#1e8e3e] dark:bg-[#1e8e3e]/15'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'}"
          >
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-white">Assisted Mode</span>
                <input type="radio" name="mode" value="assisted" bind:group={policy.mode} class="text-[#1e8e3e] focus:ring-[#1e8e3e]" />
              </div>
              <p class="mt-1.5 text-[11px] text-slate-500 leading-normal">
                AI menyiapkan balasan otomatis, admin cukup klik <strong>Approve (A)</strong> untuk mengirim.
              </p>
            </div>
            <span class="mt-3 inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Rekomendasi Pilot</span>
          </label>

          <!-- Auto Mode -->
          <label
            class="flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition {policy.mode === 'auto'
              ? 'border-brand-500 bg-brand-500/5 dark:border-brand-500 dark:bg-brand-500/15'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'}"
          >
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-white">Full Auto</span>
                <input type="radio" name="mode" value="auto" bind:group={policy.mode} class="text-brand-500 focus:ring-brand-500" />
              </div>
              <p class="mt-1.5 text-[11px] text-slate-500 leading-normal">
                Auto-reply langsung dikirim untuk komentar aman & intent terdaftar. Komentar berisiko tetap ditahan!
              </p>
            </div>
            <span class="mt-3 inline-block text-[10px] font-semibold text-brand-500 dark:text-brand-400">Khusus Owner</span>
          </label>
        </div>
      </div>

      <!-- 2. Allowed Intents for Auto-Reply -->
      <div class="soft-card p-5.5">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">
          Intent Komentar yang Boleh Dibalas Otomatis
        </h2>
        <p class="mt-1 text-xs text-slate-500">
          Kategori komentar mana saja yang diizinkan untuk dibalas secara otomatis saat mode Auto aktif.
        </p>

        <div class="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {#each [
            { id: 'praise', label: 'Pujian (Praise)' },
            { id: 'purchase_intent', label: 'Minat Beli' },
            { id: 'question', label: 'Pertanyaan' },
            { id: 'complaint', label: 'Keluhan' }
          ] as item}
            {@const isChecked = policy.autoReplyIntents.includes(item.id as Intent)}
            <button
              type="button"
              class="flex items-center justify-between rounded-xl border p-3 text-xs font-semibold transition {isChecked
                ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-slate-200 text-slate-500 dark:border-slate-800'}"
              onclick={() => toggleIntent(item.id as Intent)}
            >
              <span>{item.label}</span>
              <input type="checkbox" checked={isChecked} class="rounded text-emerald-600 focus:ring-emerald-500" />
            </button>
          {/each}
        </div>
      </div>

      <!-- 3. Safety Controls & Throttling (PRD §4.3 & FR-5) -->
      <div class="soft-card p-5.5">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">
          Ambang Batas Keamanan & Throttling
        </h2>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <!-- Confidence Threshold -->
          <div>
            <div class="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Minimal Confidence:</span>
              <span class="font-mono text-brand-500">{Math.round(policy.minConfidence * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.99"
              step="0.05"
              bind:value={policy.minConfidence}
              class="mt-2 w-full accent-brand-500"
            />
            <p class="mt-1 text-[10px] text-slate-400">Di bawah batas ini otomatis masuk antrean review.</p>
          </div>

          <!-- Daily Quota -->
          <div>
            <label for="daily-limit" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Batas Auto-Reply / Hari:
            </label>
            <input id="daily-limit"
              type="number"
              bind:value={policy.dailyAutoReplyLimit}
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
            />
            <p class="mt-1 text-[10px] text-slate-400">Mencegah deteksi spam platform.</p>
          </div>

          <!-- Auto-hide spam toggle -->
          <div>
            <label for="autohide" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Auto-Hide Spam:
            </label>
            <div class="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="autohide"
                bind:checked={policy.autoHideSpam}
                class="h-4 w-4 rounded text-brand-500 focus:ring-brand-500"
              />
              <label for="autohide" class="text-xs text-slate-600 dark:text-slate-400">
                Sembunyikan judol/link otomatis
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Brand Voice Editor -->
      <div class="soft-card p-5.5 space-y-4">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">
          Brand Voice & Gaya Bahasa
        </h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="brand-name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Brand / Toko:</label>
            <input id="brand-name"
              type="text"
              bind:value={policy.brandVoice.brandName}
              class="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label for="brand-tone" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Tone / Gaya Bahasa:</label>
            <input id="brand-tone"
              type="text"
              bind:value={policy.brandVoice.tone}
              class="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label for="brand-cta" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Default Call-To-Action (CTA):</label>
          <input id="brand-cta"
            type="text"
            bind:value={policy.brandVoice.cta}
            class="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <!-- Forbidden phrases editor -->
        <div>
          <label for="forbidden-phrase" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Daftar Frasa Terlarang (Post-Check Rule):
          </label>
          <div class="mt-2 flex flex-wrap gap-1.5">
            {#each policy.brandVoice.forbiddenPhrases as phrase}
              <span class="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30">
                <span>"{phrase}"</span>
                <button type="button" aria-label={`Hapus frasa ${phrase}`} onclick={() => removeForbiddenPhrase(phrase)} class="hover:text-rose-700 transition-colors">
                  <X class="h-3 w-3" />
                </button>
              </span>
            {/each}
          </div>

          <div class="mt-2 flex gap-2">
            <input id="forbidden-phrase"
              type="text"
              placeholder="Tambah frasa terlarang..."
              bind:value={newForbiddenPhrase}
              onkeydown={(e) => e.key === 'Enter' && addForbiddenPhrase()}
              class="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              class="rounded-lg bg-slate-100 px-3 text-xs font-semibold hover:bg-slate-200 dark:bg-slate-800"
              onclick={addForbiddenPhrase}
            >
              Tambah
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Col: Interactive Live Brand Voice Tester -->
    <div class="space-y-4">
      <div class="soft-card p-5.5">
        <div class="flex items-center gap-2 text-brand-500 dark:text-brand-400">
          <Wand2 class="h-5 w-5" />
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">
            Uji Coba Brand Voice (Live)
          </h2>
        </div>
        <p class="mt-1 text-xs text-slate-500">
          Simulasikan bagaimana AI membalas komentar calon pelanggan sebelum dipublikasikan.
        </p>

        <div class="mt-4 space-y-3 text-xs">
          <div>
            <label for="sampleAuthorInput" class="block font-semibold text-slate-700 dark:text-slate-300">Nama Pengirim:</label>
            <input
              id="sampleAuthorInput"
              type="text"
              bind:value={sampleAuthorInput}
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label for="sampleCommentInput" class="block font-semibold text-slate-700 dark:text-slate-300">Teks Komentar Contoh:</label>
            <textarea
              id="sampleCommentInput"
              rows="3"
              bind:value={sampleCommentInput}
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 leading-relaxed"
            ></textarea>
          </div>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-95 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
            onclick={handleRunPreview}
            disabled={isTestingPreview || !sampleCommentInput.trim()}
          >
            <Play class="h-3.5 w-3.5 fill-current" />
            <span>{isTestingPreview ? 'Memproses AI...' : 'Uji Brand Voice'}</span>
          </button>
        </div>

        <!-- Preview Results Output -->
        {#if previewResult}
          <div class="mt-5 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 animate-in fade-in">
            <h4 class="text-xs font-bold text-slate-900 dark:text-white">Hasil Evaluasi AI:</h4>

            <!-- Classification -->
            <div class="space-y-1 text-xs">
              <span class="text-slate-400">Klasifikasi:</span>
              <div class="flex flex-wrap gap-1 mt-0.5">
                <Badge type="sentiment" value={previewResult.classification.sentiment} />
                <Badge type="intent" value={previewResult.classification.intent} />
                <Badge type="risk" value={previewResult.classification.riskLabel} />
              </div>
            </div>

            <!-- Decision -->
            <div class="text-xs">
              <span class="text-slate-400">Keputusan Sistem:</span>
              <p class="font-bold {previewResult.decision.canAutoSend ? 'text-emerald-600' : 'text-amber-600'}">
                {previewResult.decision.targetStatus}
              </p>
              <p class="text-[11px] text-slate-500">{previewResult.decision.reason}</p>
            </div>

            <!-- Draft -->
            <div class="text-xs pt-1">
              <span class="text-slate-400">Draft Balasan AI:</span>
              <div class="mt-1 rounded-xl bg-slate-50 p-2.5 text-slate-900 border border-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                "{previewResult.draft}"
              </div>
            </div>

            <!-- Post-Check -->
            <div class="text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
              <span class="font-semibold text-slate-700 dark:text-slate-300">Post-Check Rules:</span>
              {#if previewResult.postCheck.passed}
                <span class="ml-1 text-emerald-600 font-bold">Lolos Validasi (Aman)</span>
              {:else}
                <span class="ml-1 text-rose-500 font-bold">Pelanggaran Ditemukan:</span>
                <ul class="list-disc pl-4 text-rose-500">
                  {#each previewResult.postCheck.violations as v}
                    <li>{v}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
