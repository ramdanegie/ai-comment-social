<script lang="ts">
  import {
    MessageSquareQuote,
    Check,
    ArrowRight,
    ArrowLeft,
    Shield,
    X,
    CheckCircle2
  } from 'lucide-svelte';
  import InstagramIcon from './icons/InstagramIcon.svelte';
  import FacebookIcon from './icons/FacebookIcon.svelte';
  import { toast } from '$lib/toast';

  let {
    isOpen = $bindable(false),
    onClose = () => {},
    isLangEn = false
  }: {
    isOpen?: boolean;
    onClose?: () => void;
    isLangEn?: boolean;
  } = $props();

  let currentStep: number = $state(1);
  let workspaceName: string = $state('');
  let platformChoice: string = $state('instagram');
  let accountUsername: string = $state('');
  let brandTone: string = $state('Ramah, sopan, dan bersahabat khas UMKM fashion');
  let useEmoji: boolean = $state(true);
  let defaultCta: string = $state('Silakan DM kami ya kak untuk info ukuran!');

  function handleNext() {
    if (currentStep < 4) {
      currentStep++;
    } else {
      isOpen = false;
      currentStep = 1;
      toast.success(
        isLangEn
          ? 'Onboarding complete! Workspace is now active in Shadow mode.'
          : 'Onboarding selesai! Workspace baru telah aktif dalam mode Shadow (kalibrasi).',
        isLangEn ? 'Setup Finished' : 'Setup Selesai'
      );
      onClose();
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      currentStep--;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
    <div class="glass-panel w-full max-w-lg p-6 sm:p-7">
      <!-- Top Wizard Header -->
      <div class="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white">
            <MessageSquareQuote class="h-4 w-4" />
          </div>
          <span class="text-sm font-bold text-slate-900 dark:text-white">
            Setup Brand Baru — Langkah {currentStep} dari 4
          </span>
        </div>
        <button type="button" class="text-slate-400 hover:text-slate-600" onclick={onClose}>
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Step Progress Bar -->
      <div class="mt-4 flex gap-1.5">
        {#each [1, 2, 3, 4] as s}
          <div class="h-1 flex-1 rounded-full {s <= currentStep ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-800'}"></div>
        {/each}
      </div>

      <!-- Step Content -->
      <div class="mt-6 min-h-[220px]">
        {#if currentStep === 1}
          <!-- Step 1: Workspace & Tenant -->
          <div class="space-y-4 text-xs">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Nama Bisnis / Brand</h3>
              <p class="text-slate-500">Nama ini akan digunakan sebagai identitas tenant dan referensi akun.</p>
            </div>
            <div>
              <label for="onboardWsName" class="block font-semibold text-slate-700 dark:text-slate-300">Nama Workspace:</label>
              <input
                id="onboardWsName"
                type="text"
                bind:value={workspaceName}
                class="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div class="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-850 dark:text-slate-400">
              Setiap tenant mendapatkan trial paket <strong>Growth (Shadow Mode)</strong> gratis selama 14 hari.
            </div>
          </div>
        {:else if currentStep === 2}
          <!-- Step 2: Channel Connect -->
          <div class="space-y-4 text-xs">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Hubungkan Saluran Sosial</h3>
              <p class="text-slate-500">Koneksikan Instagram Professional atau Facebook Page bisnis Anda.</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="flex flex-col items-center justify-center rounded-xl border p-4 transition {platformChoice === 'instagram' ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700'}"
                onclick={() => (platformChoice = 'instagram')}
              >
                <InstagramIcon class="h-6 w-6 text-pink-500 mb-1" />
                <span class="font-bold">Instagram</span>
                <span class="text-[10px] text-slate-400">Akun Professional</span>
              </button>
              <button
                type="button"
                class="flex flex-col items-center justify-center rounded-xl border p-4 transition {platformChoice === 'facebook' ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700'}"
                onclick={() => (platformChoice = 'facebook')}
              >
                <FacebookIcon class="h-6 w-6 text-blue-600 mb-1" />
                <span class="font-bold">Facebook Page</span>
                <span class="text-[10px] text-slate-400">Halaman Bisnis</span>
              </button>
            </div>
            <div>
              <label for="onboardUsername" class="block font-semibold text-slate-700 dark:text-slate-300">Username Akun:</label>
              <input
                id="onboardUsername"
                type="text"
                bind:value={accountUsername}
                class="mt-1 w-full rounded-xl border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        {:else if currentStep === 3}
          <!-- Step 3: Brand Voice -->
          <div class="space-y-4 text-xs">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Gaya Bahasa & Brand Voice</h3>
              <p class="text-slate-500">Atur cara AI merespon calon pembeli agar terdengar natural dan otentik.</p>
            </div>
            <div>
              <label for="onboardBrandTone" class="block font-semibold text-slate-700 dark:text-slate-300">Tone of Voice:</label>
              <input
                id="onboardBrandTone"
                type="text"
                bind:value={brandTone}
                class="mt-1 w-full rounded-xl border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label for="onboardDefaultCta" class="block font-semibold text-slate-700 dark:text-slate-300">Default Call-To-Action (CTA):</label>
              <input
                id="onboardDefaultCta"
                type="text"
                bind:value={defaultCta}
                class="mt-1 w-full rounded-xl border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="emojiOn" bind:checked={useEmoji} class="h-4 w-4 rounded text-brand-500 focus:ring-brand-500" />
              <label for="emojiOn" class="font-semibold text-slate-700 dark:text-slate-300">
                Gunakan gaya bahasa santai dan ramah
              </label>
            </div>
          </div>
        {:else}
          <!-- Step 4: Shadow Mode Activation -->
          <div class="space-y-4 text-center text-xs py-4">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Shield class="h-8 w-8" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Siap Mengaktifkan Shadow Mode!</h3>
              <p class="mt-1 text-slate-500 max-w-sm mx-auto">
                Komentar masuk akan segera ditarik dan dianalisis AI untuk membuat rekomendasi draft balasan, tanpa risiko terkirim ke publik sebelum Anda setujui.
              </p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Bottom Wizard Buttons -->
      <div class="mt-6 flex items-center justify-between border-t pt-4 border-slate-100/60 dark:border-slate-800/60">
        {#if currentStep > 1}
          <button
            type="button"
            class="glass-pill inline-flex items-center gap-1.5 px-4.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
            onclick={handleBack}
          >
            <ArrowLeft class="h-3.5 w-3.5" />
            <span>Kembali</span>
          </button>
        {:else}
          <div></div>
        {/if}

        <button
          type="button"
          class="btn-primary-glass inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold text-white shadow-md active:scale-95 transition"
          onclick={handleNext}
        >
          <span>{currentStep === 4 ? 'Selesaikan & Mulai' : 'Lanjutkan'}</span>
          <ArrowRight class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
{/if}
