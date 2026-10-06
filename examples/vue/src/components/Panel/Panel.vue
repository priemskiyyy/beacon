<script setup lang="ts">
import { CARD_CLASS_NAME } from "example-shared/ui/styles/cardStyles";
import IconTile from "src/components/IconTile/IconTile.vue";
import type { IconName } from "src/types/IconName";

type Props = { title: string; icon: IconName; shows: string };

defineProps<Props>();
</script>

<template>
  <section
    :aria-label="title"
    :class="['flex h-full min-w-0 flex-col gap-4 p-5', CARD_CLASS_NAME]"
  >
    <header class="flex flex-col gap-1.5">
      <div class="flex flex-wrap items-center gap-2">
        <IconTile :icon="icon" size="small" />
        <h3
          class="text-base font-semibold tracking-tight text-zinc-800 dark:text-zinc-200"
        >
          {{ title }}
        </h3>
        <div
          v-if="$slots.aside"
          class="ml-auto flex flex-wrap items-center gap-2"
        >
          <slot name="aside" />
        </div>
      </div>
      <p class="text-sm text-zinc-500 dark:text-zinc-400">{{ shows }}</p>
    </header>
    <slot />
  </section>
</template>
