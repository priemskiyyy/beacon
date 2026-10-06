<script setup lang="ts">
import { badgeStyles } from "example-shared/ui/styles/badgeStyles";
import { dotStyles } from "example-shared/ui/styles/dotStyles";
import type { Tone } from "example-shared/ui/types/Tone";

type Props = { tone: Tone; dot?: boolean };

// A state as a badge; `dot` adds the light that marks a state that is live.
defineProps<Props>();
</script>

<template>
  <span :class="badgeStyles({ tone })">
    <span v-if="dot" aria-hidden="true" :class="dotStyles({ tone })" />
    <slot />
  </span>
</template>
