<script setup lang="ts">
import type { Observation, RouteBody } from "@priemskiyyy/beacon";
import { computed } from "vue";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { FRESHNESS_TONES } from "example-shared/ui/constants/tones";
import Badge from "src/components/Badge/Badge.vue";
import Fact from "src/components/Fact/Fact.vue";

type Props = { observation: Observation<string, RouteBody> };

const props = defineProps<Props>();

const evidence = computed(() => {
  if (props.observation.status === "unknown") {
    return null;
  }

  return props.observation.evidence;
});

const formatRevision = (revision: { kind: string; value: string } | null) => {
  if (revision === null) {
    return "no revision";
  }

  return `${revision.kind} revision ${revision.value}`;
};

const lifetime = computed(() => {
  if (evidence.value === null) {
    return "";
  }

  const { expiresAt, revision } = evidence.value;

  if (expiresAt === null) {
    return `never expires, ${formatRevision(revision)}`;
  }

  return `expires ${formatClockTime(expiresAt)}, ${formatRevision(revision)}`;
});
</script>

<template>
  <Fact
    v-if="evidence === null"
    term="Evidence"
    hint="Nothing is backed until an authority answers; unknown is never an old version."
  >
    none yet
  </Fact>
  <Fact
    v-else
    term="Evidence"
    hint="Goes stale by time alone: a failed check leaves it in place and ages it."
  >
    <span class="flex flex-col items-start gap-1">
      <Badge :tone="FRESHNESS_TONES[evidence.freshness]">{{
        evidence.freshness
      }}</Badge>
      <span>{{ evidence.source }} over {{ evidence.origin }}</span>
      <span>{{ lifetime }}</span>
    </span>
  </Fact>
</template>
