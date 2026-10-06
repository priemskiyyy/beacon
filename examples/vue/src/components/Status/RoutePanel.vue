<script setup lang="ts">
import { useRoute, useBeaconStatus } from "@priemskiyyy/beacon-vue";
import { computed } from "vue";

import { formatCheck } from "example-shared/formatting/formatCheck";
import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatObservation } from "example-shared/formatting/formatObservation";
import {
  CHECK_TONES,
  OBSERVATION_TONES,
  OPERATION_TONES,
  SESSION_TONES,
} from "example-shared/ui/constants/tones";
import Badge from "src/components/Badge/Badge.vue";
import Fact from "src/components/Fact/Fact.vue";
import Panel from "src/components/Panel/Panel.vue";
import EvidenceFact from "src/components/Status/EvidenceFact.vue";

const session = useBeaconStatus(({ state }) => state);
const check = useRoute("web", ({ check: attempt }) => attempt);
const observation = useRoute("web", ({ observation: seen }) => seen);
const operation = useRoute("web", ({ operation: running }) => running);

const operationDetail = computed(() => {
  const current = operation.value;

  if (current.state === "idle") {
    return null;
  }

  if (current.state === "indeterminate") {
    return `${current.command}, operation ${current.operation.id}, ${current.reason}`;
  }

  return `${current.command}, operation ${current.operation.id}`;
});

const lastAnswer = computed(() => {
  const seen = observation.value;

  if (seen.status === "unknown") {
    return "none yet";
  }

  return formatClockTime(seen.evidence.receivedAt);
});
</script>

<template>
  <Panel
    title="Route web"
    icon="route"
    shows="Four dimensions that never rewrite each other: the check, the accepted observation, what is prepared and the running operation."
  >
    <dl class="grid gap-2 sm:grid-cols-2">
      <Fact
        term="Session"
        hint="Held by the provider while it is mounted; a check needs it."
      >
        <Badge :tone="SESSION_TONES[session]">{{ session }}</Badge>
      </Fact>
      <Fact
        term="Check"
        hint="Whether the last attempt was answered. A failure never erases what was accepted."
      >
        <span class="flex flex-col items-start gap-1">
          <Badge :tone="CHECK_TONES[check.state]">{{ check.state }}</Badge>
          <span>{{ formatCheck(check) }}</span>
        </span>
      </Fact>
      <Fact
        term="Observation"
        hint="What the authority said for this route. None is not proof that no release exists."
      >
        <span class="flex flex-col items-start gap-1">
          <Badge :tone="OBSERVATION_TONES[observation.status]">{{
            observation.status
          }}</Badge>
          <span>{{ formatObservation(observation) }}</span>
        </span>
      </Fact>
      <EvidenceFact :observation="observation" />
      <Fact
        term="Operation"
        hint="A reload that replaces the document stays unresolved until a boot or an acknowledgement."
      >
        <span class="flex flex-col items-start gap-1">
          <Badge :tone="OPERATION_TONES[operation.state]">{{
            operation.state
          }}</Badge>
          <span v-if="operationDetail !== null">{{ operationDetail }}</span>
        </span>
      </Fact>
      <Fact
        term="Last answer"
        hint="When Beacon accepted the answer it judges the route by."
      >
        {{ lastAnswer }}
      </Fact>
    </dl>
  </Panel>
</template>
