<script lang="ts">
  import CommentsView from '$lib/components/CommentsView.svelte';
  import { session } from '$lib/session.svelte';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <CommentsView workspaceSlug={session.workspace} isLangEn={session.isLangEn} />
{/key}
