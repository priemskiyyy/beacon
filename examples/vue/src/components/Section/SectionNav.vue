<script setup lang="ts">
import { navLinkStyles } from "example-shared/ui/styles/navLinkStyles";
import { useCurrentSection } from "src/composables/useCurrentSection";
import { SECTION_IDS, SECTIONS } from "src/utils/constants/sections";
import { scrollToElement } from "src/utils/scrollToElement";

const current = useCurrentSection();
</script>

<template>
  <nav aria-label="Explore the lab" class="flex gap-1 overflow-x-auto py-1">
    <button
      v-for="id in SECTION_IDS"
      :key="id"
      type="button"
      :aria-current="current === id ? 'location' : undefined"
      :class="navLinkStyles({ current: current === id })"
      @click="scrollToElement(id)"
    >
      {{ SECTIONS[id].label }}
    </button>
  </nav>
</template>
