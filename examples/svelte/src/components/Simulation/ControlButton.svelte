<script lang="ts">
  import type { Snippet } from "svelte";

  import { buttonStyles } from "example-shared/ui/styles/buttonStyles";

  type Props = {
    onPress: () => void;
    pressed?: boolean;
    disabled?: boolean;
    children: Snippet;
  };

  /** A toggle when `pressed` is given, and a plain action otherwise. */
  const { onPress, pressed, disabled = false, children }: Props = $props();
</script>

<button
  type="button"
  aria-pressed={pressed}
  {disabled}
  onclick={() => onPress()}
  class={buttonStyles({ size: "small", pressed: pressed === true })}
>
  {@render children()}
</button>
