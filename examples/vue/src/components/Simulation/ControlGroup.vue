<script setup lang="ts">
type Props = { label: string };

defineProps<Props>();
</script>

<template>
  <div role="group" :aria-label="label" class="flex flex-col gap-2">
    <h4 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
      {{ label }}
    </h4>
    <div class="flex flex-wrap gap-2"><slot /></div>
  </div>
</template>
