<script setup lang="ts">
import type { IconName } from "src/types/IconName";
import { ICON_PATHS } from "src/utils/constants/iconPaths";

type Props = { name: IconName; size?: number };

withDefaults(defineProps<Props>(), { size: 16 });
</script>

<template>
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :width="size"
    :height="size"
    class="shrink-0"
  >
    <path v-for="path in ICON_PATHS[name]" :key="path" :d="path" />
  </svg>
</template>
