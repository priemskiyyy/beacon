<script setup lang="ts">
import type { CommandOutcome } from "@priemskiyyy/beacon";
import { useBeacon, useRoute, useSupport } from "@priemskiyyy/beacon-vue";
import { computed, ref, shallowRef } from "vue";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatOutcome } from "example-shared/formatting/formatOutcome";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { describeBanner } from "example-shared/lab/utils/describeBanner";
import { OUTCOME_TONES } from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import Badge from "src/components/Badge/Badge.vue";
import Icon from "src/components/Icon/Icon.vue";
import Panel from "src/components/Panel/Panel.vue";
import { TONE_BORDERS } from "src/utils/constants/toneBorders";

type Props = { lab: ReleaseLab };

const props = defineProps<Props>();

const beacon = useBeacon();
const observation = useRoute("web", ({ observation: seen }) => seen);
const check = useRoute("web", ({ check: attempt }) => attempt);
const operation = useRoute("web", ({ operation: running }) => running);
const support = useSupport();

const outcome = shallowRef<CommandOutcome<{ kind: string }> | null>(null);
const updating = ref(false);

const banner = computed(() =>
  describeBanner({ observation: observation.value, support: support.value }),
);

const offered = computed(() => observation.value.status === "available");

const checkLabel = computed(() => {
  if (check.value.state === "checking") {
    return "Checking";
  }

  return "Check again";
});

const inconclusive = computed(() => {
  const attempt = check.value;

  if (attempt.state !== "failed") {
    return null;
  }

  const seen = observation.value;

  if (seen.status === "unknown") {
    return `Inconclusive: the last check failed (${attempt.error.code}). Beacon cannot say whether a newer build exists.`;
  }

  return `Inconclusive: the last check failed (${attempt.error.code}). The answer accepted at ${formatClockTime(seen.evidence.receivedAt)} stays, and may be out of date.`;
});

const expired = computed(() => {
  const seen = observation.value;

  if (seen.status === "unknown" || seen.evidence.freshness !== "expired") {
    return null;
  }

  const { expiresAt } = seen.evidence;

  if (expiresAt === null) {
    return "This answer expired. An update with its offer is refused until the next check.";
  }

  return `This answer expired at ${formatClockTime(expiresAt)}. An update with its offer is refused until the next check.`;
});

const handleUpdatePress = async () => {
  const seen = observation.value;

  if (seen.status !== "available") {
    return;
  }

  updating.value = true;
  outcome.value = await beacon.value
    .route("web")
    .reload({ offer: seen.offer.ref });
  updating.value = false;
};

const handleCheckPress = () => {
  props.lab.controls.check("manual");
};

const handleContinuePress = () => {
  beacon.value.route("web").acknowledge();
};
</script>

<template>
  <Panel
    title="Update banner"
    icon="download"
    shows="What an application would put in front of a person: the offer, the forced state of an unsupported build, and the outcome of the request they made."
  >
    <div
      :class="[
        'flex flex-col gap-3 rounded-xl border-2 p-4',
        TONE_BORDERS[banner.tone],
      ]"
    >
      <div class="flex flex-col gap-1">
        <h4 class="text-lg font-semibold">{{ banner.headline }}</h4>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          {{ banner.detail }}
        </p>
      </div>
      <p
        v-if="inconclusive !== null"
        role="alert"
        class="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
      >
        {{ inconclusive }}
      </p>
      <p
        v-if="expired !== null"
        class="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
      >
        {{ expired }}
      </p>
      <p
        v-if="operation.state === 'indeterminate'"
        class="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/60 dark:text-sky-200"
      >
        <Icon name="hourglass" />
        The reload was requested and the navigation has not happened. The route
        stays unresolved until a new document boots or you continue here.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="offered"
          type="button"
          :disabled="updating"
          :class="buttonStyles({ variant: 'primary' })"
          @click="handleUpdatePress"
        >
          <Icon name="download" />
          Update
        </button>
        <button
          type="button"
          :disabled="check.state === 'checking'"
          :class="buttonStyles()"
          @click="handleCheckPress"
        >
          <Icon name="refresh" />
          {{ checkLabel }}
        </button>
        <button
          v-if="operation.state === 'indeterminate'"
          type="button"
          :class="buttonStyles({ variant: 'ghost' })"
          @click="handleContinuePress"
        >
          Continue in this build
        </button>
      </div>
    </div>
    <div
      role="status"
      aria-label="Update outcome"
      class="flex flex-wrap items-center gap-2 text-sm"
    >
      <span v-if="outcome === null" class="text-zinc-500"
        >No update requested yet.</span
      >
      <template v-else>
        <Badge :tone="OUTCOME_TONES[outcome.status]">{{
          outcome.status
        }}</Badge>
        <span>{{ formatOutcome(outcome) }}</span>
      </template>
    </div>
  </Panel>
</template>
