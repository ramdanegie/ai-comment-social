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
  import { api } from '../api';
  import type { UserRole } from '../types';
  import { toast } from '$lib/toast';

  let {
    isLangEn = false,
    isDarkMode = false,
    onLogin = (_role: UserRole, _user?: any) => {},
    onToggleTheme = () => {},
    onToggleLang = () => {}
  }: {
    isLangEn?: boolean;
    isDarkMode?: boolean;
    onLogin?: (role: UserRole, user?: any) => void;
    onToggleTheme?: () => void;
    onToggleLang?: () => void;
  } = $props();

  let dbUsers: Array<{ id: string; name: string; email: string; role?: UserRole }> = $state([]);
  let email: string = $state('budi@maujahit.id');
  let password: string = $state('••••••••••••');
  let selectedDemoRole: UserRole = $state('owner');
  let isLoading: boolean = $state(false);
  let isGoogleLoading: boolean = $state(false);
  let showGooglePicker: boolean = $state(false);

  const googleAccounts = [
    {
      name: 'Budi Santoso',
      email: 'budi.santoso@gmail.com',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop'
    },
    {
      name: 'MauJahit Official',
      email: 'maujahit.id@gmail.com',
      avatarUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=120&h=120&fit=crop'
    }
  ];

  onMount(async () => {
    try {
      const users = await api.getUsers();
      const unique = Array.from(new Map(users.map((u) => [u.email, u])).values());
      dbUsers = unique;
      if (unique.length > 0) {
        email = unique[0].email;
        selectedDemoRole = unique[0].role || 'owner';
      }
    } catch {}
  });

  async function handleSubmit(e?: SubmitEvent) {
    if (e) e.preventDefault();
    isLoading = true;
    try {
      const res = await api.login(email, password);
      onLogin(res.role, res.user);
    } catch (err: any) {
      toast.error(err.message || 'Login gagal', isLangEn ? 'Authentication Failed' : 'Autentikasi Gagal');
    } finally {
      isLoading = false;
    }
  }

  async function handleQuickLogin(user: { id: string; name: string; email: string; role?: UserRole }) {
    email = user.email;
    selectedDemoRole = user.role || 'viewer';
    isLoading = true;
    try {
      const res = await api.login(user.email);
      onLogin(res.role, res.user);
    } catch (err: any) {
      toast.error(err.message || 'Login gagal', isLangEn ? 'Authentication Failed' : 'Autentikasi Gagal');
    } finally {
      isLoading = false;
    }
  }

  async function handleSelectGoogleAccount(account: { name: string; email: string; avatarUrl?: string }) {
    showGooglePicker = false;
    isGoogleLoading = true;
    try {
      const res = await api.loginWithGoogle({
        email: account.email,
        name: account.name,
        avatarUrl: account.avatarUrl
      });
      toast.success(
        isLangEn ? `Signed in with Google as ${account.name}` : `Berhasil masuk dengan Google (${account.email})`,
        'Google Sign-In'
      );
      onLogin(res.role, res.user);
    } catch (err: any) {
      toast.error(err.message || 'Google Sign-In gagal', 'Error');
    } finally {
      isGoogleLoading = false;
    }
  }
</script>

<div class="relative min-h-screen flex flex-col justify-center items-center overflow-x-hidden bg-[#f8fafc] px-4 py-8 text-slate-800 transition-colors duration-200 dark:bg-[#0b0f17] dark:text-slate-100 sm:px-6 lg:px-8">
  <!-- Ambient Moving Gradient Orbs in Background -->
  <div class="pointer-events-none fixed inset-0 overflow-hidden">
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
        <span class="flex h-2 w-2 rounded-full bg-brand-500 animate-ping"></span>
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

      <!-- Dynamic Floating Illustration Stage -->
      <div class="relative mt-8 h-96 w-full max-w-xl">
        <!-- Connecting Circuit / Flow Lines (SVG Backing) -->
        <svg class="absolute inset-0 h-full w-full pointer-events-none opacity-40 dark:opacity-30" viewBox="0 0 500 380">
          <path d="M 120 70 C 220 70, 260 160, 360 160" fill="none" stroke="#ea4335" stroke-width="2" stroke-dasharray="6,6" class="animate-pulse" />
          <path d="M 360 160 C 420 160, 420 280, 220 310" fill="none" stroke="#4285F4" stroke-width="2" stroke-dasharray="6,6" />
          <path d="M 80 260 C 140 260, 180 180, 360 160" fill="none" stroke="#34A853" stroke-width="1.5" stroke-dasharray="4,4" />
        </svg>

        <!-- Floating Card 1: Incoming Customer Comment (Instagram) -->
        <div class="absolute left-0 top-2 w-72 sm:w-80 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 animate-float-slow">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-[#ea4335] text-white shadow-xs">
                <InstagramIcon class="h-4 w-4" />
              </div>
              <div>
                <p class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">anisa_wardani</p>
                <p class="text-[10px] text-slate-400 leading-none">Instagram Comment • Baru saja</p>
              </div>
            </div>
            <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Purchase Intent
            </span>
          </div>
          <p class="mt-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            "Bagus banget kebaya ungunya! Bisa custom ukuran jumbo nggak kak? Estimasi berapa lama?"
          </p>
          <div class="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Sparkles class="h-3 w-3 text-amber-500" />
            <span>AI Confidence: <strong class="text-slate-700 dark:text-slate-300 font-semibold">98%</strong></span>
          </div>
        </div>

        <!-- Floating Card 2: AI Generating Auto-Reply in Motion -->
        <div class="absolute right-0 top-36 w-80 sm:w-88 rounded-2xl border border-brand-500/30 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-brand-500/30 dark:bg-slate-900/95 animate-float-reverse">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <div class="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-500/30">
                <Bot class="h-4 w-4" />
              </div>
              <div>
                <p class="text-xs font-bold text-slate-900 dark:text-white leading-tight">Replyra AI Agent</p>
                <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold leading-none flex items-center gap-1 mt-0.5">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Auto-Reply Siap Terkirim
                </p>
              </div>
            </div>
            <span class="rounded-md bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-[#4285F4] dark:text-blue-400 border border-blue-500/20">
              1.2s
            </span>
          </div>

          <!-- Typing Simulation -->
          <div class="mt-2.5 rounded-xl bg-slate-50/80 p-2.5 text-xs text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 leading-relaxed font-mono">
            Halo kak Anisa! Bisa banget custom ukuran jumbo. Pengerjaan 7-10 hari kerja. Silakan DM kami ya kak agar kami bantu ukurnya<span class="inline-block h-3.5 w-1.5 bg-brand-500 ml-0.5 align-middle animate-typing-cursor"></span>
          </div>

          <div class="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span class="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <Check class="h-3.5 w-3.5" /> Sesuai Aturan Brand
            </span>
            <span class="font-medium text-slate-400">Meta API Verified</span>
          </div>
        </div>

        <!-- Floating Card 3: Spam Shield Indicator (Bottom Left) -->
        <div class="absolute left-6 bottom-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 animate-float-fast">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Spam Shield Aktif</p>
            <p class="text-[10px] text-slate-400 truncate">Judi & phising otomatis di-hide</p>
          </div>
          <span class="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30"></span>
        </div>

        <!-- Floating Card 4: Metrics Badge (Bottom Right) -->
        <div class="absolute right-4 bottom-2 hidden sm:flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 animate-float-slow">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[#4285F4] dark:text-blue-400">
            <TrendingUp class="h-4 w-4" />
          </div>
          <div class="text-[11px] leading-tight">
            <p class="font-bold text-slate-900 dark:text-white">10x Lebih Cepat</p>
            <p class="text-[9px] text-slate-400">Respon &lt; 6 menit</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: High-Conversion Clean Login Card -->
    <div class="w-full lg:col-span-5">
      <div class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:p-8">
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
              Pilih cara masuk yang Anda inginkan
            </p>
          </div>
        </div>

        <!-- Google One-Click SSO Primary Action -->
        <div class="mt-6">
          <button
            type="button"
            disabled={isLoading || isGoogleLoading}
            class="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200/90 bg-white py-3 px-4 text-xs font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 active:scale-98 disabled:opacity-50"
            onclick={() => (showGooglePicker = true)}
          >
            {#if isGoogleLoading}
              <Loader2 class="h-4.5 w-4.5 animate-spin text-brand-500" />
              <span>{isLangEn ? 'Connecting with Google...' : 'Menghubungkan ke Google...'}</span>
            {:else}
              <svg class="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isLangEn ? 'Continue with Google' : 'Lanjutkan dengan Google'}</span>
            {/if}
          </button>
        </div>

        <!-- Clean Divider -->
        <div class="relative my-5 flex items-center justify-center">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200/80 dark:border-slate-800"></div>
          </div>
          <span class="relative bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-900">
            {isLangEn ? 'or use account' : 'atau akun demo'}
          </span>
        </div>

        <!-- Quick 1-Click Role Login Selector (from PostgreSQL Database) -->
        {#if dbUsers.length > 0}
          <div class="mb-5 space-y-1.5">
            <div class="grid grid-cols-3 gap-2">
              {#each dbUsers as u}
                <button
                  type="button"
                  class="flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all {email === u.email
                    ? 'border-brand-500 bg-brand-500/8 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'}"
                  onclick={() => handleQuickLogin(u)}
                >
                  <span class="text-xs font-semibold capitalize">{u.role || 'User'}</span>
                  <span class="text-[10px] text-slate-400 font-normal truncate max-w-full">{u.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Standard Email/Password Form -->
        <form onsubmit={handleSubmit} class="space-y-3.5">
          <div>
            <label for="loginEmail" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email
            </label>
            <div class="relative mt-1">
              <Mail class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="loginEmail"
                type="email"
                bind:value={email}
                required
                class="h-9.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
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
                required
                class="h-9.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
              />
            </div>
          </div>

          <!-- Primary Login Submit Button -->
          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            class="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-white shadow-sm shadow-brand-500/25 transition-all hover:bg-brand-600 hover:shadow-brand-500/35 active:scale-98 disabled:opacity-50"
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

        <!-- Footnote Status Badge -->
        <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></span>
            <span>{isLangEn ? 'System Active' : 'Sistem Aktif'}</span>
          </div>
          <span class="font-mono text-[10px]">v1.0.0</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Google SSO Account Picker Modal -->
  {#if showGooglePicker}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <svg class="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span class="text-sm font-bold text-slate-900 dark:text-white">Pilih Akun Google</span>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            onclick={() => (showGooglePicker = false)}
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Pilih akun Google untuk masuk ke workspace Replyra secara aman.
        </p>

        <div class="mt-4 space-y-2">
          {#each googleAccounts as acc}
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-xl border border-slate-200/80 p-3 text-left transition hover:border-[#4285F4] hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-blue-950/20"
              onclick={() => handleSelectGoogleAccount(acc)}
            >
              <div class="flex items-center gap-3 min-w-0">
                <img src={acc.avatarUrl} alt={acc.name} class="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700" />
                <div class="min-w-0">
                  <p class="truncate text-xs font-bold text-slate-900 dark:text-white">{acc.name}</p>
                  <p class="truncate text-[11px] text-slate-400">{acc.email}</p>
                </div>
              </div>
              <ArrowRight class="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          {/each}
        </div>

        <button
          type="button"
          class="mt-4 w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-center text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          onclick={() => handleSelectGoogleAccount({ name: 'Google User', email: `user.${Date.now().toString(36)}@gmail.com` })}
        >
          + Gunakan Akun Google Lain
        </button>
      </div>
    </div>
  {/if}
</div>
