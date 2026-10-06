<script setup lang="ts">
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import EmptyState from "src/components/EmptyState/EmptyState.vue";
import Icon from "src/components/Icon/Icon.vue";
import Panel from "src/components/Panel/Panel.vue";
import TimelineRow from "src/components/Timeline/TimelineRow.vue";
import { useEventLog } from "src/composables/useEventLog";

type Props = { lab: ReleaseLab };

const props = defineProps<Props>();
const entries = useEventLog(props.lab.timeline);
</script>

<template>
  <Panel
    title="Timeline"
    icon="history"
    shows="Beacon's diagnostics, the journal's changes and what the world did, newest first. A diagnostic names counts and codes, never a manifest or a URL."
  >
    <template #aside>
      <button
        type="button"
        :class="buttonStyles({ size: 'small', variant: 'ghost' })"
        @click="lab.timeline.clear()"
      >
        <Icon name="trash" :size="14" />
        Clear
      </button>
    </template>
    <EmptyState
      v-if="entries.length === 0"
      icon="history"
      title="Nothing recorded yet"
      description="Check, publish or reload, and each step appears here."
    />
    <ol
      v-else
      aria-label="Timeline entries"
      class="flex max-h-[28rem] flex-col divide-y divide-zinc-200/70 overflow-y-auto text-sm dark:divide-zinc-800"
    >
      <TimelineRow v-for="entry in entries" :key="entry.id" :entry="entry" />
    </ol>
  </Panel>
</template>
