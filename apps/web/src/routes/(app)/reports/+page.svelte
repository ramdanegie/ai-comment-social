<script lang="ts">
  import ReportsView from '$lib/components/ReportsView.svelte';
  import { session } from '$lib/session.svelte';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <ReportsView workspaceSlug={session.workspace} isLangEn={session.isLangEn} />
{/key}
