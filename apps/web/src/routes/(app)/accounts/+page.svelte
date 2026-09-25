<script lang="ts">
  import AccountsView from '$lib/components/AccountsView.svelte';
  import { session } from '$lib/session.svelte';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <AccountsView workspaceSlug={session.workspace} isLangEn={session.isLangEn} />
{/key}
