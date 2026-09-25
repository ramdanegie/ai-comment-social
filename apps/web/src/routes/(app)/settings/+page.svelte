<script lang="ts">
  import SettingsView from '$lib/components/SettingsView.svelte';
  import { session } from '$lib/session.svelte';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <SettingsView workspaceSlug={session.workspace} isLangEn={session.isLangEn} />
{/key}
