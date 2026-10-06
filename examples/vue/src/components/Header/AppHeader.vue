<script setup lang="ts">
import { useObservable, useStatus } from "@priemskiyyy/beacon-vue";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { SESSION_TONES } from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import Badge from "src/components/Badge/Badge.vue";
import Icon from "src/components/Icon/Icon.vue";
import IconTile from "src/components/IconTile/IconTile.vue";
import SectionNav from "src/components/Section/SectionNav.vue";

type Props = { lab: ReleaseLab };

const props = defineProps<Props>();
const state = useStatus(({ state: session }) => session);
const number = useObservable(props.lab.boot, ({ number: boot }) => boot);
</script>

<template>
  <header
    class="sticky top-0 z-20 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70"
  >
    <div
      class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6"
    >
      <div class="mr-auto flex min-w-0 flex-wrap items-center gap-2">
        <IconTile icon="broadcast" size="small" />
        <h1 class="text-lg font-semibold">Release lab</h1>
        <Badge :tone="SESSION_TONES[state]" dot>session {{ state }}</Badge>
        <Badge tone="neutral">document {{ number }}</Badge>
      </div>
      <div class="order-last w-full min-w-0 lg:order-none lg:w-auto">
        <SectionNav />
      </div>
      <button
        type="button"
        :class="buttonStyles({ variant: 'ghost', size: 'small' })"
        @click="lab.controls.reset()"
      >
        <Icon name="reset" :size="14" />
        Reset demo
      </button>
    </div>
  </header>
</template>
