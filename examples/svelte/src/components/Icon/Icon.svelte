<script lang="ts">
  import type { IconName } from "src/types/IconName";
  import { ICON_PATHS } from "src/utils/constants/icons";

  type Props = { name: IconName; size: number; class?: string };

  const { name, size, class: className = "" }: Props = $props();
</script>

<svg
  aria-hidden="true"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
>
  {#each ICON_PATHS[name] as path (path)}
    <path d={path} />
  {/each}
</svg>
