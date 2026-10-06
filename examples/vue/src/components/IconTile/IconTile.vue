<script setup lang="ts">
import { computed } from "vue";

import { iconTileStyles } from "example-shared/ui/styles/iconTileStyles";
import Icon from "src/components/Icon/Icon.vue";
import type { IconName } from "src/types/IconName";

type Props = { icon: IconName; size: "regular" | "small" };

const ICON_SIZES: Record<Props["size"], number> = { regular: 20, small: 16 };

const props = defineProps<Props>();
const iconSize = computed(() => ICON_SIZES[props.size]);
</script>

<template>
  <span aria-hidden="true" :class="iconTileStyles({ size })">
    <Icon :name="icon" :size="iconSize" />
  </span>
</template>
