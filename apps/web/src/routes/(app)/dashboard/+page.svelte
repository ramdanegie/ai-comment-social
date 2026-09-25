<script lang="ts">
  import DashboardView from '$lib/components/DashboardView.svelte';
  import { session } from '$lib/session.svelte';
  import { goto } from '$app/navigation';
  import { pathFor } from '$lib/nav';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <DashboardView workspaceSlug={session.workspace} isLangEn={session.isLangEn} onSelectPage={(id) => goto(pathFor(id))} />
{/key}
