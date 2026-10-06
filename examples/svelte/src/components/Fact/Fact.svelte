<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = { term: string; hint: string; children: Snippet };

  const { term, hint, children }: Props = $props();

  const id = $props.id();
</script>

<div
  class="flex flex-col gap-0.5 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
>
  <dt {id} class="text-xs font-medium text-zinc-500">
    {term}
  </dt>
  <dd aria-labelledby={id} class="font-mono text-sm break-all">
    {@render children()}
  </dd>
  <p class="text-xs text-zinc-500">{hint}</p>
</div>
