<script lang="ts">
  import { iconTileStyles } from "example-shared/ui/styles/iconTileStyles";
  import Icon from "src/components/Icon/Icon.svelte";
  import type { IconName } from "src/types/IconName";

  type Props = { icon: IconName; size: "regular" | "small" };

  const { icon, size }: Props = $props();

  const ICON_SIZES: Record<Props["size"], number> = {
    regular: 20,
    small: 16,
  };
</script>

<span aria-hidden="true" class={iconTileStyles({ size })}>
  <Icon name={icon} size={ICON_SIZES[size]} />
</span>
