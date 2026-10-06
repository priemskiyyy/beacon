<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = { label: string; children: Snippet };

  const { label, children }: Props = $props();
</script>

<div role="group" aria-label={label} class="flex flex-col gap-2">
  <h4 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
    {label}
  </h4>
  <div class="flex flex-wrap gap-2">{@render children()}</div>
</div>
