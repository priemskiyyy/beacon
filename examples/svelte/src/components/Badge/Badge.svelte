<script lang="ts">
  import type { Snippet } from "svelte";

  import { badgeStyles } from "example-shared/ui/styles/badgeStyles";
  import { dotStyles } from "example-shared/ui/styles/dotStyles";
  import type { Tone } from "example-shared/ui/types/Tone";

  type Props = { tone: Tone; dot?: boolean; children: Snippet };

  /** A state as a badge; `dot` adds the light that marks a state that is live. */
  const { tone, dot = false, children }: Props = $props();
</script>

<span class={badgeStyles({ tone })}>
  {#if dot}
    <span aria-hidden="true" class={dotStyles({ tone })}></span>
  {/if}
  {@render children()}
</span>
