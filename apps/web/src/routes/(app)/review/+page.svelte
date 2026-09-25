<script lang="ts">
  import ReviewQueueView from '$lib/components/ReviewQueueView.svelte';
  import { session, refreshReviewCount } from '$lib/session.svelte';
</script>

<!-- Re-mount when the workspace switcher changes so the view reloads its data -->
{#key session.workspace}
  <ReviewQueueView workspaceSlug={session.workspace} isLangEn={session.isLangEn} currentRole={session.role} onReviewed={refreshReviewCount} />
{/key}
