<script lang="ts">
  import { onMount } from 'svelte';
  import {
    MessageSquareQuote,
    Mail,
    Lock,
    ArrowRight,
    ShieldCheck,
    Sun,
    Moon,
    Globe,
    X,
    Check,
    Loader2,
    Sparkles,
    Zap,
    TrendingUp,
    Bot,
    MessageCircle
  } from 'lucide-svelte';
  import InstagramIcon from './icons/InstagramIcon.svelte';
  import { api, type Me } from '../api';
  import { toast } from '$lib/toast';

  let {
    isLangEn = false,
    isDarkMode = false,
    onLogin = (_me: Me) => {},
    onToggleTheme = () => {},
    onToggleLang = () => {}
  }: {
    isLangEn?: boolean;
    isDarkMode?: boolean;
    onLogin?: (me: Me) => void;
    onToggleTheme?: () => void;
    onToggleLang?: () => void;
  } = $props();

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let isGoogleLoading = $state(false);
  let errorMessage = $state<string | null>(null);

  async function handleGoogleLogin() {
    if (isLoading || isGoogleLoading) return;
    isGoogleLoading = true;
    errorMessage = null;
    try {
      window.location.href = await api.googleSignInUrl();
    } catch (err: any) {
      errorMessage = err.message;
      isGoogleLoading = false;
    }
  }

  async function handleSubmit(e?: SubmitEvent) {
    e?.preventDefault();
    if (isLoading) return;
    isLoading = true;
    errorMessage = null;
    try {
      const me = await api.signIn(email.trim().toLowerCase(), password);
      if (me.workspaces.length === 0) {
        toast.warning(
          isLangEn ? 'Your account is not a member of any workspace yet.' : 'Akun Anda belum tergabung di workspace mana pun.'
        );
      }
      onLogin(me);
    } catch (err: any) {
      errorMessage = err.message || 'Login gagal';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="login-shell relative min-h-dvh flex flex-col justify-center items-center overflow-x-hidden px-4 py-8 text-slate-800 transition-colors duration-200 dark:text-slate-100 sm:px-6 lg:px-8">
  <!-- Ambient Moving Gradient Orbs in Background -->
  <div aria-hidden="true" class="hidden">
    <div class="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl animate-pulse-glow"></div>
    <div class="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-[#4285F4]/12 blur-3xl animate-float-reverse"></div>
    <div class="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-[#34A853]/10 blur-3xl animate-float-slow"></div>
    <div class="absolute top-2/3 right-1/4 h-64 w-64 rounded-full bg-[#FBBC05]/10 blur-3xl animate-pulse-glow"></div>
  </div>

  <!-- Top Right Utility: Theme & Language Toggle -->
  <div class="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-8 sm:top-8">
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-xs font-bold text-slate-700 shadow-2xs backdrop-blur-md transition-all hover:bg-slate-100 dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
      onclick={onToggleLang}
      title={isLangEn ? 'Switch to Indonesian' : 'Ganti ke Bahasa Inggris'}
      aria-label="Toggle Bahasa"
    >
      <Globe class="h-4 w-4" />
    </button>

    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 shadow-2xs backdrop-blur-md transition-all hover:bg-slate-100 dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
      onclick={onToggleTheme}
      title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
      aria-label="Toggle Theme"
    >
      {#if isDarkMode}
        <Sun class="h-4 w-4 text-amber-400" />
      {:else}
        <Moon class="h-4 w-4 text-slate-600" />
      {/if}
    </button>
  </div>

  <!-- Main Container: Split Showcase & Form -->
  <div class="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-12 lg:gap-12">
    <!-- Left Showcase: Interactive Moving Illustrations (SaaS Autopilot Flow) -->
    <div class="relative flex flex-col justify-center lg:col-span-7">
      <!-- Brand Pill -->
      <div class="inline-flex items-center gap-2.5 rounded-full border border-brand-500/20 bg-brand-500/10 px-3.5 py-1.5 backdrop-blur-md w-fit shadow-2xs">
        <span class="flex h-2 w-2 rounded-full bg-brand-500 "></span>
        <span class="text-xs font-bold text-brand-500 tracking-wide">Replyra AI • Auto-Moderation</span>
      </div>

      <!-- Main Headline (Crisp, High Impact, Non-cluttered) -->
      <h1 class="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl leading-tight">
        Moderasi Komentar & Balasan AI <span class="text-brand-500">Tanpa Ribet.</span>
      </h1>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
        {isLangEn
          ? 'Autonomous social comment auto-reply and 24/7 spam shield for your Meta accounts.'
          : 'Balas otomatis minat beli calon pelanggan Instagram & Facebook, serta bersihkan komentar spam secara otomatis.'}
      </p>

      <!-- Dynamic Animated Isometric Blueprint Stage (Inspired by ngodingpakeai.com) -->
      <div class="iso-stage relative mt-6 hidden w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-2 shadow-xl backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 lg:block">
        <svg
          viewBox="0 0 680 405"
          class="h-auto w-full select-none"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <!-- Blueprint Dotted Grid -->
          <g stroke-opacity="0.14" stroke-width="1.5" stroke-dasharray="2 8">
            <!-- Vertical Grid Lines -->
            <line x1="20" y1="0" x2="20" y2="405" />
            <line x1="60" y1="0" x2="60" y2="405" />
            <line x1="100" y1="0" x2="100" y2="405" />
            <line x1="140" y1="0" x2="140" y2="405" />
            <line x1="180" y1="0" x2="180" y2="405" />
            <line x1="220" y1="0" x2="220" y2="405" />
            <line x1="260" y1="0" x2="260" y2="405" />
            <line x1="300" y1="0" x2="300" y2="405" />
            <line x1="340" y1="0" x2="340" y2="405" />
            <line x1="380" y1="0" x2="380" y2="405" />
            <line x1="420" y1="0" x2="420" y2="405" />
            <line x1="460" y1="0" x2="460" y2="405" />
            <line x1="500" y1="0" x2="500" y2="405" />
            <line x1="540" y1="0" x2="540" y2="405" />
            <line x1="580" y1="0" x2="580" y2="405" />
            <line x1="620" y1="0" x2="620" y2="405" />
            <line x1="660" y1="0" x2="660" y2="405" />

            <!-- Horizontal Grid Lines -->
            <line x1="0" y1="20" x2="680" y2="20" />
            <line x1="0" y1="50" x2="680" y2="50" />
            <line x1="0" y1="80" x2="680" y2="80" />
            <line x1="0" y1="110" x2="680" y2="110" />
            <line x1="0" y1="140" x2="680" y2="140" />
            <line x1="0" y1="170" x2="680" y2="170" />
            <line x1="0" y1="200" x2="680" y2="200" />
            <line x1="0" y1="230" x2="680" y2="230" />
            <line x1="0" y1="260" x2="680" y2="260" />
            <line x1="0" y1="290" x2="680" y2="290" />
            <line x1="0" y1="320" x2="680" y2="320" />
            <line x1="0" y1="350" x2="680" y2="350" />
            <line x1="0" y1="380" x2="680" y2="380" />
          </g>

          <!-- Interconnecting Traces / Flow Lines -->
          <g stroke-opacity="0.4" stroke-width="2">
            <!-- Trace 1: From Inbound Comment to AI Engine Core -->
            <path d="M 265 95 C 295 95, 305 115, 325 115" stroke="#ea4335" stroke-dasharray="4 4" />
            
            <!-- Trace 2: From AI Engine Core to Auto-Reply Station -->
            <path d="M 365 115 C 385 115, 395 115, 415 115" stroke="#10b981" stroke-dasharray="4 4" />

            <!-- Trace 3: From AI Engine Core down to Spam Shield -->
            <path d="M 345 155 L 345 195 C 345 220, 310 220, 275 220" stroke="#f59e0b" stroke-dasharray="4 4" />
          </g>

          <!-- Animated Flow Chevrons (Circuit Signals) -->
          <g transform="translate(275 95)">
            <g class="sc-flow" style="animation-delay: 0s">
              <path d="M -5 -5 L 3 0 L -5 5" stroke="#ea4335" stroke-width="2.5" fill="none" />
            </g>
          </g>
          <g transform="translate(295 105)">
            <g class="sc-flow" style="animation-delay: 0.3s">
              <path d="M -5 -5 L 3 0 L -5 5" stroke="#ea4335" stroke-width="2.5" fill="none" />
            </g>
          </g>
          <g transform="translate(378 115)">
            <g class="sc-flow" style="animation-delay: 0.15s">
              <path d="M -5 -5 L 3 0 L -5 5" stroke="#10b981" stroke-width="2.5" fill="none" />
            </g>
          </g>
          <g transform="translate(398 115)">
            <g class="sc-flow" style="animation-delay: 0.45s">
              <path d="M -5 -5 L 3 0 L -5 5" stroke="#10b981" stroke-width="2.5" fill="none" />
            </g>
          </g>
          <g transform="translate(330 220)">
            <g class="sc-flow" style="animation-delay: 0.25s">
              <path d="M 5 -5 L -3 0 L 5 5" stroke="#f59e0b" stroke-width="2.5" fill="none" />
            </g>
          </g>

          <!-- Panel 1: Inbound Social Comment (Top Left) -->
          <g class="iso-card-1">
            <rect x="20" y="25" width="245" height="142" rx="14" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.35" stroke-width="2" />
            
            <!-- Blueprint Corner Registration Marks -->
            <rect x="16" y="21" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />
            <rect x="261" y="21" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />
            <rect x="16" y="163" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />
            <rect x="261" y="163" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />

            <!-- Avatar & User Info -->
            <rect x="34" y="38" width="24" height="24" rx="7" fill="#ea4335" fill-opacity="0.12" stroke="#ea4335" stroke-width="1.6" />
            <rect x="38" y="42" width="16" height="16" rx="4.5" stroke="#ea4335" stroke-width="1.6" fill="none" />
            <circle cx="46" cy="50" r="3.2" stroke="#ea4335" stroke-width="1.4" fill="none" />
            <circle cx="50" cy="46" r="0.9" fill="#ea4335" stroke="none" />

            <text x="66" y="46" font-size="12" font-weight="700" fill="currentColor" fill-opacity="0.92" stroke="none">anisa_wardani</text>
            <text x="66" y="59" font-size="9" font-weight="500" fill="currentColor" fill-opacity="0.5" stroke="none">Instagram Comment • 2m lalu</text>

            <!-- Intent Badge -->
            <rect x="180" y="39" width="75" height="20" rx="10" fill="#10b981" fill-opacity="0.15" stroke="#10b981" stroke-width="1.5" />
            <text x="217" y="52" font-size="9" font-weight="700" fill="#10b981" stroke="none" text-anchor="middle">★ Minat Beli</text>

            <!-- Card Internal Divider -->
            <line x1="32" y1="70" x2="253" y2="70" stroke="currentColor" stroke-opacity="0.15" stroke-width="1" />

            <!-- Customer Text -->
            <text x="34" y="93" font-size="11.5" font-weight="600" fill="currentColor" fill-opacity="0.9" stroke="none">
              "Bisa custom ukuran jumbo?"
            </text>

            <!-- Wireframe Text Strokes -->
            <line x1="34" y1="110" x2="225" y2="110" stroke-width="4.5" stroke-opacity="0.35" stroke="currentColor" class="sc-pulse-line" />
            <line x1="34" y1="122" x2="165" y2="122" stroke-width="4.5" stroke-opacity="0.22" stroke="currentColor" />

            <!-- AI Confidence Pill -->
            <circle cx="42" cy="146" r="4" fill="#f59e0b" stroke="none" />
            <text x="52" y="149" font-size="9" font-weight="600" fill="currentColor" fill-opacity="0.75" stroke="none">AI Confidence: 98% (High Intent)</text>
          </g>

          <!-- Central AI Brain Core Node -->
          <g>
            <!-- Expanding Radar Pulse Rings (Continuous radiating) -->
            <circle cx="345" cy="115" r="22" stroke="#ea4335" stroke-width="2" fill="none" class="sc-ripple" />
            <circle cx="345" cy="115" r="22" stroke="#ea4335" stroke-width="2" fill="none" class="sc-ripple" style="animation-delay: 1.5s" />
            
            <!-- Core Housing -->
            <g class="sc-core-pulse">
              <rect x="323" y="93" width="44" height="44" rx="12" fill="currentColor" fill-opacity="0.08" stroke="#ea4335" stroke-width="2.5" />
              <!-- Sparkle / Brain Icon Inside -->
              <path d="M 345 101 L 347 111 L 357 113 L 347 115 L 345 125 L 343 115 L 333 113 L 343 111 Z" fill="#ea4335" stroke="none" />
            </g>

            <!-- Processing Speed Indicator -->
            <rect x="310" y="145" width="70" height="20" rx="10" fill="#ea4335" fill-opacity="0.12" stroke="#ea4335" stroke-width="1.5" />
            <text x="345" y="158" font-size="9" font-weight="700" fill="#ea4335" stroke="none" text-anchor="middle">⚡ AI 0.8s</text>
          </g>

          <!-- Spam Shield Filter Branch Node (Middle Left) -->
          <g class="iso-card-3">
            <rect x="135" y="196" width="168" height="52" rx="12" fill="currentColor" fill-opacity="0.05" stroke="#10b981" stroke-opacity="0.55" stroke-width="1.8" />
            
            <!-- Shield Icon -->
            <g transform="translate(145 208)">
              <path d="M 12 2 L 2 6 V 14 C 2 20 12 24 12 24 C 12 24 22 20 22 14 V 6 Z" stroke="#10b981" stroke-width="2" fill="#10b981" fill-opacity="0.15" />
              <path d="M 8 13 L 11 16 L 16 10" stroke="#10b981" stroke-width="2" fill="none" />
            </g>

            <text x="178" y="217" font-size="11" font-weight="700" fill="currentColor" fill-opacity="0.9" stroke="none">Spam Shield</text>
            <text x="178" y="233" font-size="8.5" font-weight="500" fill="#10b981" stroke="none">Auto-hide judi & scam</text>
            
            <!-- Blinking Status Dot -->
            <circle cx="286" cy="222" r="3.5" fill="#10b981" stroke="none" class="sc-blink" />
          </g>

          <!-- Panel 2: AI Auto-Reply & Meta Dispatch Station (Right) -->
          <g class="iso-card-2">
            <rect x="415" y="25" width="245" height="248" rx="14" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.4" stroke-width="2" />

            <!-- Blueprint Corner Marks -->
            <rect x="411" y="21" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />
            <rect x="656" y="21" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />
            <rect x="411" y="269" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />
            <rect x="656" y="269" width="8" height="8" fill="currentColor" stroke="none" opacity="0.4" />

            <!-- Header: Bot Identity & Verification -->
            <rect x="428" y="38" width="26" height="26" rx="8" fill="#ea4335" stroke="none" />
            <circle cx="437" cy="50" r="1.5" fill="white" stroke="none" />
            <circle cx="445" cy="50" r="1.5" fill="white" stroke="none" />
            <path d="M 437 55 Q 441 58 445 55" stroke="white" stroke-width="1.2" fill="none" />

            <text x="462" y="47" font-size="12" font-weight="700" fill="currentColor" fill-opacity="0.92" stroke="none">Replyra AI Agent</text>
            <circle cx="466" cy="58" r="3" fill="#10b981" stroke="none" />
            <text x="474" y="61" font-size="8.5" font-weight="600" fill="#10b981" stroke="none">Auto-Reply Aktif</text>

            <!-- Meta Verified Badge -->
            <rect x="575" y="40" width="73" height="19" rx="5" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
            <text x="611" y="52" font-size="8" font-weight="600" fill="currentColor" fill-opacity="0.75" stroke="none" text-anchor="middle">Meta Verified</text>

            <!-- Header Divider -->
            <line x1="427" y1="70" x2="648" y2="70" stroke="currentColor" stroke-opacity="0.15" stroke-width="1" />

            <!-- Typewriter Auto-Reply Text Container -->
            <rect x="427" y="80" width="221" height="82" rx="8" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />

            <defs>
              <clipPath id="sc-type-clip-1">
                <rect x="436" y="86" width="202" height="18" class="sc-type-line-1" />
              </clipPath>
              <clipPath id="sc-type-clip-2">
                <rect x="436" y="104" width="202" height="18" class="sc-type-line-2" />
              </clipPath>
              <clipPath id="sc-type-clip-3">
                <rect x="436" y="122" width="202" height="18" class="sc-type-line-3" />
              </clipPath>
            </defs>

            <!-- Simulated Typing Sentences -->
            <text x="437" y="99" font-size="9.5" font-family="monospace" font-weight="600" fill="currentColor" fill-opacity="0.95" stroke="none" clip-path="url(#sc-type-clip-1)">
              Halo kak Anisa! Bisa banget custom
            </text>
            <text x="437" y="117" font-size="9.5" font-family="monospace" font-weight="600" fill="currentColor" fill-opacity="0.95" stroke="none" clip-path="url(#sc-type-clip-2)">
              ukuran jumbo. Ready 5-7 hari kerja.
            </text>
            <text x="437" y="135" font-size="9.5" font-family="monospace" font-weight="600" fill="currentColor" fill-opacity="0.95" stroke="none" clip-path="url(#sc-type-clip-3)">
              Silakan DM kami untuk detailnya ya kak!
            </text>
            <!-- Blinking typing cursor moving with sc-caret -->
            <g class="sc-caret-track">
              <line x1="436" y1="126" x2="436" y2="140" stroke="#ea4335" stroke-width="2.5" class="sc-blink" />
            </g>

            <!-- Rule Compliance Verification Indicators -->
            <g transform="translate(432 172)">
              <g class="sc-pop-badge-1">
                <circle cx="8" cy="8" r="6" fill="#10b981" fill-opacity="0.25" stroke="#10b981" stroke-width="1.5" />
                <path d="M 5 8 L 7 10 L 11 6" stroke="#10b981" stroke-width="1.8" fill="none" />
                <text x="20" y="11" font-size="9.5" font-weight="600" fill="currentColor" fill-opacity="0.88" stroke="none">Tone: Ramah & Santun</text>
              </g>
            </g>

            <g transform="translate(432 194)">
              <g class="sc-pop-badge-2">
                <circle cx="8" cy="8" r="6" fill="#10b981" fill-opacity="0.25" stroke="#10b981" stroke-width="1.5" />
                <path d="M 5 8 L 7 10 L 11 6" stroke="#10b981" stroke-width="1.8" fill="none" />
                <text x="20" y="11" font-size="9.5" font-weight="600" fill="currentColor" fill-opacity="0.88" stroke="none">Katalog & Stok: Sinkron</text>
              </g>
            </g>

            <g transform="translate(432 216)">
              <g class="sc-pop-badge-3">
                <circle cx="8" cy="8" r="6" fill="#10b981" fill-opacity="0.25" stroke="#10b981" stroke-width="1.5" />
                <path d="M 5 8 L 7 10 L 11 6" stroke="#10b981" stroke-width="1.8" fill="none" />
                <text x="20" y="11" font-size="9.5" font-weight="600" fill="currentColor" fill-opacity="0.88" stroke="none">Anti-Hallucination: Aman</text>
              </g>
            </g>

            <!-- Final Sent Badge -->
            <g class="sc-pop-sent">
              <rect x="427" y="244" width="221" height="20" rx="6" fill="#10b981" fill-opacity="0.18" stroke="#10b981" stroke-width="1.5" />
              <text x="537" y="257" font-size="9" font-weight="700" fill="#10b981" stroke="none" text-anchor="middle">✓ Balasan Terkirim Otomatis (0.8s)</text>
            </g>
          </g>

          <!-- Bottom Real-Time Performance Matrix -->
          <g>
            <rect x="20" y="280" width="375" height="102" rx="14" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.8" />
            
            <!-- Header row of the banner -->
            <circle cx="42" cy="303" r="11" fill="#ea4335" fill-opacity="0.15" stroke="#ea4335" stroke-width="1.5" />
            <path d="M 38 303 L 41 306 L 46 300" stroke="#ea4335" stroke-width="2" fill="none" />
            <text x="60" y="302" font-size="11" font-weight="800" fill="currentColor" stroke="none">24/7 Autopilot Engine</text>
            <text x="60" y="314" font-size="8.5" font-weight="500" fill="currentColor" fill-opacity="0.5" stroke="none">Real-time social engagement & revenue shield</text>

            <!-- Equalizer Activity Soundbars (Bouncing animated) -->
            <g transform="translate(355 303)">
              <line x1="-8" y1="-8" x2="-8" y2="8" stroke="#ea4335" stroke-width="2.5" class="sc-bar" style="animation-delay: 0s" />
              <line x1="-2" y1="-8" x2="-2" y2="8" stroke="#ea4335" stroke-width="2.5" class="sc-bar" style="animation-delay: 0.2s" />
              <line x1="4" y1="-8" x2="4" y2="8" stroke="#ea4335" stroke-width="2.5" class="sc-bar" style="animation-delay: 0.4s" />
              <line x1="10" y1="-8" x2="10" y2="8" stroke="#ea4335" stroke-width="2.5" class="sc-bar" style="animation-delay: 0.15s" />
            </g>

            <!-- Divider -->
            <line x1="32" y1="326" x2="383" y2="326" stroke="currentColor" stroke-opacity="0.15" stroke-width="1" />

            <!-- 3 Metrics Grid Columns -->
            <g transform="translate(35 342)">
              <text x="0" y="10" font-size="14" font-weight="800" fill="#10b981" stroke="none">99.8%</text>
              <text x="0" y="25" font-size="8.5" font-weight="600" fill="currentColor" fill-opacity="0.5" stroke="none">Response Rate</text>
            </g>

            <g transform="translate(160 342)">
              <text x="0" y="10" font-size="14" font-weight="800" fill="currentColor" stroke="none">0.8 detik</text>
              <text x="0" y="25" font-size="8.5" font-weight="600" fill="currentColor" fill-opacity="0.5" stroke="none">Rata-rata Respon</text>
            </g>

            <g transform="translate(285 342)">
              <text x="0" y="10" font-size="14" font-weight="800" fill="#ea4335" stroke="none">+3.8x</text>
              <text x="0" y="25" font-size="8.5" font-weight="600" fill="currentColor" fill-opacity="0.5" stroke="none">Konversi Penjualan</text>
            </g>
          </g>
        </svg>
      </div>
    </div>

    <!-- Right: High-Conversion Clean Login Card -->
    <div class="w-full lg:col-span-5">
      <div class="soft-card p-6 sm:p-8 shadow-2xl">
        <!-- Logo & Card Header -->
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-md shadow-brand-500/30">
            <MessageSquareQuote class="h-6 w-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Masuk ke Replyra
            </h2>
            <p class="text-xs text-slate-400 dark:text-slate-500">
              Masuk dengan email dan kata sandi
            </p>
          </div>
        </div>


        {#if errorMessage}
          <div class="mt-5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
            {errorMessage}
          </div>
        {/if}

        <!-- Google Sign-In Button -->
        <div class="mt-5">
          <button
            type="button"
            disabled={isLoading || isGoogleLoading}
            onclick={handleGoogleLogin}
            class="flex h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/90 px-4 text-xs font-semibold text-slate-700 shadow-2xs backdrop-blur-sm transition hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700/80 disabled:opacity-60 active:scale-98"
          >
            {#if isGoogleLoading}
              <div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
              <span>{isLangEn ? 'Connecting to Google...' : 'Menghubungkan ke Google...'}</span>
            {:else}
              <svg class="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>{isLangEn ? 'Sign in with Google' : 'Masuk dengan Google'}</span>
            {/if}
          </button>
        </div>

        <!-- Divider -->
        <div class="relative my-4 flex items-center justify-center">
          <div class="w-full border-t border-slate-200/80 dark:border-slate-800/80"></div>
          <span class="absolute bg-white px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:bg-slate-900 dark:text-slate-500">
            {isLangEn ? 'or with email' : 'atau dengan email'}
          </span>
        </div>

        <!-- Standard Email/Password Form -->
        <form onsubmit={handleSubmit} class="space-y-3.5">
          <div>
            <label for="loginEmail" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isLangEn ? 'Email or Username' : 'Email atau Username'}
            </label>
            <div class="relative mt-1">
              <Mail class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="loginEmail"
                type="text"
                bind:value={email}
                autocomplete="username"
                inputmode="email"
                placeholder={isLangEn ? 'name@company.com or username' : 'nama@bisnis.id atau email'}
                required
                class="h-9.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label for="loginPassword" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isLangEn ? 'Password' : 'Kata Sandi'}
            </label>
            <div class="relative mt-1">
              <Lock class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="loginPassword"
                type="password"
                bind:value={password}
                autocomplete="current-password"
                placeholder={isLangEn ? 'Enter your password' : 'Kata sandi akun Anda'}
                required
                class="h-9.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <!-- Primary Login Submit Button -->
          <button
            type="submit"
            disabled={isLoading}
            class="btn-primary-glass mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-xs font-bold text-white shadow-md disabled:opacity-50 active:scale-95"
          >
            {#if isLoading}
              <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>{isLangEn ? 'Verifying...' : 'Memverifikasi...'}</span>
            {:else}
              <span>{isLangEn ? 'Sign In to Dashboard' : 'Masuk ke Dashboard'}</span>
              <ArrowRight class="h-4 w-4" />
            {/if}
          </button>
        </form>

        <p class="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {isLangEn ? "Don't have an account?" : 'Belum punya akun?'}
          <a href="/register" class="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            {isLangEn ? 'Start free trial' : 'Daftar & coba gratis'}
          </a>
        </p>

        <!-- Footnote Status Badge -->
        <div class="mt-5 flex items-center justify-between border-t border-slate-100/60 pt-3.5 text-[11px] text-slate-400 dark:border-slate-800/60 dark:text-slate-500">
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></span>
            <span>{isLangEn ? 'System Active' : 'Sistem Aktif'}</span>
          </div>
          <span class="font-mono text-[10px]">v1.0.0</span>
        </div>
      </div>
    </div>
  </div>

</div>

<style>
  .iso-stage svg * {
    transform-box: fill-box;
  }

  @media (prefers-reduced-motion: reduce) {
    .iso-stage svg * {
      animation: none !important;
    }
  }

  /* Gentle floating elevation for blueprint cards */
  .iso-stage .iso-card-1 {
    animation: iso-float-1 6s ease-in-out infinite;
  }
  @keyframes iso-float-1 {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-4px); }
  }

  .iso-stage .iso-card-2 {
    animation: iso-float-2 7s ease-in-out infinite;
  }
  @keyframes iso-float-2 {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(4px); }
  }

  .iso-stage .iso-card-3 {
    animation: iso-float-3 5.5s ease-in-out infinite;
  }
  @keyframes iso-float-3 {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
  }

  /* Circuit Signal Chevrons Flow */
  .iso-stage .sc-flow {
    animation: sc-flow 1.4s ease-out infinite;
  }
  @keyframes sc-flow {
    0% { transform: translateX(-12px); opacity: 0; }
    30% { opacity: 0.95; }
    100% { transform: translateX(14px); opacity: 0; }
  }

  /* Expanding Radar Ripple Rings from AI Brain Core */
  .iso-stage .sc-ripple {
    transform-origin: center center;
    animation: sc-ripple 3s ease-out infinite;
  }
  @keyframes sc-ripple {
    0% { transform: scale(0.7); opacity: 0.95; }
    100% { transform: scale(2.2); opacity: 0; }
  }

  /* AI Brain Heartbeat Pulse */
  .iso-stage .sc-core-pulse {
    transform-origin: center center;
    animation: sc-core-pulse 3s ease-in-out infinite;
  }
  @keyframes sc-core-pulse {
    0%, 100% { transform: scale(1); }
    15% { transform: scale(1.08); }
    25% { transform: scale(1); }
  }

  /* Typewriter Text Progression: 6s loop */
  .iso-stage .sc-type-line-1 {
    transform-origin: 0 50%;
    animation: sc-type-1 6s steps(28, end) infinite;
  }
  @keyframes sc-type-1 {
    0% { transform: scaleX(0); }
    20%, 94% { transform: scaleX(1); }
    98%, 100% { transform: scaleX(0); }
  }

  .iso-stage .sc-type-line-2 {
    transform-origin: 0 50%;
    animation: sc-type-2 6s steps(28, end) infinite;
  }
  @keyframes sc-type-2 {
    0%, 20% { transform: scaleX(0); }
    42%, 94% { transform: scaleX(1); }
    98%, 100% { transform: scaleX(0); }
  }

  .iso-stage .sc-type-line-3 {
    transform-origin: 0 50%;
    animation: sc-type-3 6s steps(28, end) infinite;
  }
  @keyframes sc-type-3 {
    0%, 42% { transform: scaleX(0); }
    64%, 94% { transform: scaleX(1); }
    98%, 100% { transform: scaleX(0); }
  }

  /* Caret track animation following lines 1, 2, and 3 */
  .iso-stage .sc-caret-track {
    animation: sc-caret-track 6s steps(28, end) infinite;
  }
  @keyframes sc-caret-track {
    0% { transform: translate(0px, -22px); opacity: 1; }
    20% { transform: translate(182px, -22px); opacity: 1; }
    21% { transform: translate(0px, -4px); opacity: 1; }
    42% { transform: translate(175px, -4px); opacity: 1; }
    43% { transform: translate(0px, 14px); opacity: 1; }
    64%, 94% { transform: translate(195px, 14px); opacity: 1; }
    98%, 100% { transform: translate(0px, -22px); opacity: 0; }
  }

  /* Compliance Badges Popping in Sequence with high base visibility */
  .iso-stage .sc-pop-badge-1 {
    transform-origin: center center;
    animation: sc-pop-b1 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  }
  @keyframes sc-pop-b1 {
    0%, 35% { transform: scale(0.97); opacity: 0.75; }
    40% { transform: scale(1.15); opacity: 1; }
    45%, 94% { transform: scale(1); opacity: 1; }
    98%, 100% { transform: scale(0.97); opacity: 0.75; }
  }

  .iso-stage .sc-pop-badge-2 {
    transform-origin: center center;
    animation: sc-pop-b2 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  }
  @keyframes sc-pop-b2 {
    0%, 48% { transform: scale(0.97); opacity: 0.75; }
    53% { transform: scale(1.15); opacity: 1; }
    58%, 94% { transform: scale(1); opacity: 1; }
    98%, 100% { transform: scale(0.97); opacity: 0.75; }
  }

  .iso-stage .sc-pop-badge-3 {
    transform-origin: center center;
    animation: sc-pop-b3 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  }
  @keyframes sc-pop-b3 {
    0%, 60% { transform: scale(0.97); opacity: 0.75; }
    65% { transform: scale(1.15); opacity: 1; }
    70%, 94% { transform: scale(1); opacity: 1; }
    98%, 100% { transform: scale(0.97); opacity: 0.75; }
  }

  /* Sent Confirmation Pill Pop */
  .iso-stage .sc-pop-sent {
    transform-origin: center center;
    animation: sc-pop-sent 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  }
  @keyframes sc-pop-sent {
    0%, 68% { transform: scale(0.97); opacity: 0.8; }
    73% { transform: scale(1.08); opacity: 1; }
    78%, 94% { transform: scale(1); opacity: 1; }
    98%, 100% { transform: scale(0.97); opacity: 0.8; }
  }

  /* Blinking cursor and status dots */
  .iso-stage .sc-blink {
    animation: sc-blink 1s steps(1, end) infinite;
  }
  @keyframes sc-blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }

  /* Soundbar Equalizer Bouncing */
  .iso-stage .sc-bar {
    transform-origin: center bottom;
    animation: sc-bar 0.75s ease-in-out infinite alternate;
  }
  @keyframes sc-bar {
    0% { transform: scaleY(0.2); }
    100% { transform: scaleY(1); }
  }

  .iso-stage .sc-pulse-line {
    animation: sc-pulse-line 3s ease-in-out infinite;
  }
  @keyframes sc-pulse-line {
    0%, 100% { stroke-opacity: 0.35; }
    50% { stroke-opacity: 0.7; }
  }
</style>
