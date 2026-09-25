<script lang="ts">
  let { children } = $props();
</script>

<div class="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200">
  <header class="border-b border-slate-100 dark:border-slate-800">
    <nav class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4 text-sm">
      <a href="/" class="font-semibold text-slate-900 dark:text-white">Replyra</a>
      <div class="flex gap-4 text-slate-500">
        <a href="/privacy" class="hover:text-slate-900 dark:hover:text-white">Privacy</a>
        <a href="/terms" class="hover:text-slate-900 dark:hover:text-white">Terms</a>
        <a href="/data-deletion" class="hover:text-slate-900 dark:hover:text-white">Data Deletion</a>
      </div>
    </nav>
  </header>
  <main class="legal mx-auto max-w-3xl px-6 py-10">
    {@render children()}
  </main>
  <footer class="mx-auto max-w-3xl px-6 pb-10 text-xs text-slate-400">
    © 2026 PT CREATIVE SHINE INNOVATION · Replyra · admin@creativeshine.id
  </footer>
</div>

<style>
  .legal :global(h1) { font-size: 1.75rem; font-weight: 600; letter-spacing: -0.01em; color: inherit; }
  .legal :global(h2) { margin-top: 2rem; font-size: 1.125rem; font-weight: 600; }
  .legal :global(p), .legal :global(li) { margin-top: 0.75rem; line-height: 1.7; font-size: 0.95rem; }
  .legal :global(ul) { list-style: disc; padding-left: 1.25rem; }
  .legal :global(ol) { list-style: decimal; padding-left: 1.25rem; }
  .legal :global(a) { text-decoration: underline; }
  .legal :global(.updated) { margin-top: 0.25rem; font-size: 0.8rem; color: rgb(100 116 139); }
</style>
