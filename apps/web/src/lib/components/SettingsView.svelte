<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Users,
    UserPlus,
    Shield,
    ScrollText,
    History,
    Check,
    X,
    Lock,
    Eye
  } from 'lucide-svelte';
  import { api } from '../api';
  import type { AuditLogItem } from '../types';
  import { toast } from '$lib/toast';

  let {
    workspaceSlug = 'maujahit',
    isLangEn = false
  }: {
    workspaceSlug?: string;
    isLangEn?: boolean;
  } = $props();

  let auditLogs: AuditLogItem[] = $state([]);
  let loading: boolean = $state(true);
  let showInviteModal: boolean = $state(false);
  let inviteEmail: string = $state('');
  let inviteRole: string = $state('admin');
  let isInviting: boolean = $state(false);

  let members: Array<{ id?: string; name: string; email: string; role: string; createdAt?: string; joined?: string }> = $state([]);

  async function loadData() {
    loading = true;
    try {
      const [logs, mems] = await Promise.all([
        api.getAuditLogs(workspaceSlug),
        api.getMembers(workspaceSlug)
      ]);
      auditLogs = logs;
      members = mems.map((m) => ({
        ...m,
        joined: m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Aktif'
      }));
    } finally {
      loading = false;
    }
  }

  onMount(loadData);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    const targetEmail = inviteEmail.trim();
    isInviting = true;
    try {
      await api.inviteMember(workspaceSlug, {
        email: targetEmail,
        role: inviteRole,
        name: targetEmail.split('@')[0]
      });
      showInviteModal = false;
      inviteEmail = '';
      await loadData();
      toast.success(
        isLangEn
          ? `Invitation sent successfully to ${targetEmail}!`
          : `Undangan anggota tim ${targetEmail} berhasil dikirim!`,
        isLangEn ? 'Invitation Sent' : 'Undangan Terkirim'
      );
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan anggota tim', 'Error');
    } finally {
      isInviting = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {isLangEn ? 'Team Settings & Audit Log' : 'Pengaturan Tim & Audit Log'}
      </h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLangEn
          ? 'Manage tenant team memberships, permissions, and security event logs'
          : 'Kelola akses anggota tim (Owner/Admin/Viewer) dan jejak audit kepatuhan Meta'}
      </p>
    </div>

    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-600 active:scale-95"
      onclick={() => (showInviteModal = true)}
    >
      <UserPlus class="h-4 w-4" />
      <span>Undang Anggota</span>
    </button>
  </div>

  <!-- Team Members Table -->
  <div class="soft-card p-5.5">
    <h2 class="text-sm font-bold text-slate-900 dark:text-white">
      Anggota Tim Workspace
    </h2>
    <div class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-100 font-semibold text-slate-500 dark:border-slate-800">
          <tr>
            <th class="py-2.5">Nama & Email</th>
            <th class="py-2.5">Hak Akses (Role)</th>
            <th class="py-2.5">Bergabung</th>
            <th class="py-2.5 text-right">Izin</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          {#each members as m}
            <tr>
              <td class="py-3">
                <p class="font-bold text-slate-900 dark:text-white">{m.name}</p>
                <p class="text-slate-400 font-mono text-[11px]">{m.email}</p>
              </td>
              <td class="py-3">
                <span class="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider {m.role === 'owner'
                  ? 'bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-500/20'
                  : m.role === 'admin'
                    ? 'bg-[#1a73e8]/10 text-[#1a73e8] dark:bg-[#1a73e8]/20 dark:text-blue-300 border border-[#1a73e8]/20'
                    : 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-500/20'}">
                  {m.role}
                </span>
              </td>
              <td class="py-3 text-slate-500">{m.joined}</td>
              <td class="py-3 text-right text-[11px] text-slate-400">
                {#if m.role === 'owner'}
                  Kelola paket, akun & hapus data
                {:else if m.role === 'admin'}
                  Approve/edit balasan & atur policy
                {:else}
                  Read-only dashboard & review
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Audit Log Trail -->
  <div class="soft-card p-5.5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">
          Jejak Audit Aktivitas (Audit Log)
        </h2>
        <p class="text-xs text-slate-500">Merekam semua keputusan manusia dan aksi otomatis AI demi kepatuhan Meta</p>
      </div>
      <History class="h-4 w-4 text-slate-400" />
    </div>

    <div class="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
      {#each auditLogs as log}
        <div class="py-3 flex items-start justify-between gap-3 text-xs">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900 dark:text-white">{log.actor}</span>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {log.action}
              </span>
            </div>
            {#if log.meta}
              <p class="text-[11px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-850 p-2 rounded-lg">
                {JSON.stringify(log.meta)}
              </p>
            {/if}
          </div>
          <span class="text-[11px] text-slate-400 font-mono whitespace-nowrap">
            {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Invite Member Modal -->
{#if showInviteModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Undang Anggota Tim Baru</h3>
        <button type="button" class="text-slate-400 hover:text-slate-600" onclick={() => (showInviteModal = false)}>
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-4 space-y-4 text-xs">
        <div>
          <label for="inviteEmailInput" class="block font-semibold text-slate-700 dark:text-slate-300">Alamat Email:</label>
          <input
            id="inviteEmailInput"
            type="email"
            placeholder="nama@perusahaan.com"
            bind:value={inviteEmail}
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div>
          <label for="inviteRoleSelect" class="block font-semibold text-slate-700 dark:text-slate-300">Role & Hak Akses:</label>
          <select
            id="inviteRoleSelect"
            bind:value={inviteRole}
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="admin">Admin — Bisa review, approve, dan atur policy</option>
            <option value="viewer">Viewer — Hanya bisa melihat data & laporan</option>
          </select>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
          onclick={() => (showInviteModal = false)}
        >
          Batal
        </button>
        <button
          type="button"
          class="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-600 transition active:scale-98"
          onclick={handleInvite}
        >
          Kirim Undangan
        </button>
      </div>
    </div>
  </div>
{/if}
