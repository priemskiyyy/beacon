<script setup lang="ts">
import { useBeacon, useTransitions } from "@priemskiyyy/beacon-vue";
import { computed } from "vue";

import { formatIdentity } from "example-shared/formatting/formatIdentity";
import { RECONCILIATION_LABELS } from "example-shared/lab/constants/labels";
import {
  JOURNAL_TONES,
  RECONCILIATION_TONES,
} from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import Badge from "src/components/Badge/Badge.vue";
import Fact from "src/components/Fact/Fact.vue";
import Icon from "src/components/Icon/Icon.vue";
import Panel from "src/components/Panel/Panel.vue";

const CHECKPOINT = "primary-screen";

const beacon = useBeacon();
const journal = useTransitions(({ journal: state }) => state);
const latest = useTransitions(({ latest: last }) => last);
const dropped = useTransitions(({ dropped: count }) => count);
const checkpoints = useTransitions(({ checkpoints: reported }) => reported);

const latestIntent = computed(() => {
  const last = latest.value;

  if (last === null) {
    return "none recorded";
  }

  const { intent } = last;
  const target = formatIdentity(
    intent.target ?? { status: "unknown", reason: "no-target" },
  );

  return `${intent.command} on ${intent.route} from ${intent.boot.id}, aimed at ${target}`;
});

const reported = computed(() => {
  if (checkpoints.value.length === 0) {
    return "none reported";
  }

  return checkpoints.value.join(", ");
});

const handleReadyPress = () => {
  beacon.value.reportReady({ checkpoint: CHECKPOINT });
};

const handleClearPress = () => {
  beacon.value.clearJournal();
};
</script>

<template>
  <Panel
    title="Transitions"
    icon="notebook"
    shows="The intent written before a reload, and what the next boot says about it. It is never proof that anything was installed or that the boot is healthy."
  >
    <template #aside>
      <button
        type="button"
        :class="buttonStyles({ size: 'small' })"
        @click="handleReadyPress"
      >
        <Icon name="flag" :size="14" />
        Report ready
      </button>
      <button
        type="button"
        :class="buttonStyles({ size: 'small', variant: 'ghost' })"
        @click="handleClearPress"
      >
        <Icon name="trash" :size="14" />
        Clear journal
      </button>
    </template>
    <dl class="grid gap-2 sm:grid-cols-2">
      <Fact
        term="Journal"
        hint="Off without storage; degraded when a read or a write failed."
      >
        <Badge :tone="JOURNAL_TONES[journal]">{{ journal }}</Badge>
      </Fact>
      <Fact
        term="Latest intent"
        hint="Written before the reload, from the boot that asked for it."
      >
        {{ latestIntent }}
      </Fact>
      <Fact
        term="Outcome"
        hint="What this boot's running facts say about the intent."
      >
        <template v-if="latest === null">nothing to reconcile</template>
        <span v-else class="flex flex-col items-start gap-1">
          <Badge :tone="RECONCILIATION_TONES[latest.outcome]">{{
            latest.outcome
          }}</Badge>
          <span>{{ RECONCILIATION_LABELS[latest.outcome] }}</span>
        </span>
      </Fact>
      <Fact
        term="Unreached boots"
        hint="Boots in a row that left the same target unreached, against the budget."
      >
        <template v-if="latest === null">0</template>
        <span v-else class="flex flex-wrap items-center gap-2">
          {{ latest.attempts }}
          <Badge v-if="latest.exhausted" tone="danger">budget spent</Badge>
        </span>
      </Fact>
      <Fact
        term="Checkpoints"
        hint="What the application reported in this boot; without one, readiness is unknown."
      >
        {{ reported }}
      </Fact>
      <Fact
        term="Dropped intents"
        hint="Older intents the journal let go of, so that coverage is visibly gone."
      >
        {{ dropped }}
      </Fact>
    </dl>
  </Panel>
</template>
