<script lang="ts">
  import BillingView from '$lib/components/BillingView.svelte';
  import { session } from '$lib/session.svelte';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <BillingView workspaceSlug={session.workspace} isLangEn={session.isLangEn} />
{/key}
