<script setup lang="ts">
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";

type Props = { pressed?: boolean | undefined; disabled?: boolean };

// A toggle when `pressed` is given, and a plain action otherwise. Vue casts an absent boolean prop to false, so its default is spelled out.
withDefaults(defineProps<Props>(), { pressed: undefined, disabled: false });

const emit = defineEmits<{ press: [] }>();
</script>

<template>
  <button
    type="button"
    :aria-pressed="pressed"
    :disabled="disabled"
    :class="buttonStyles({ size: 'small', pressed: pressed === true })"
    @click="emit('press')"
  >
    <slot />
  </button>
</template>
