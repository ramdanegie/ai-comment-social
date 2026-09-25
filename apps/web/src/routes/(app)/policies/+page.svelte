<script lang="ts">
  import PoliciesView from '$lib/components/PoliciesView.svelte';
  import { session } from '$lib/session.svelte';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <PoliciesView workspaceSlug={session.workspace} isLangEn={session.isLangEn} />
{/key}
