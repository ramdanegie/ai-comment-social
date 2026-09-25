<script lang="ts">
  import AdminView from '$lib/components/AdminView.svelte';
  import { session } from '$lib/session.svelte';
</script>

<svelte:head><title>Superadmin · Replyra</title></svelte:head>

{#if session.user?.isSuperadmin}
  <AdminView />
{:else}
  <!-- The API enforces this too (403); the UI only hides it. -->
  <p class="mt-16 text-center text-sm text-slate-500">Halaman ini khusus pengelola platform.</p>
{/if}
