<script setup lang="ts">
import { useObservable } from "@priemskiyyy/beacon-vue";
import { computed } from "vue";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatDraft } from "example-shared/formatting/formatDraft";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import Badge from "src/components/Badge/Badge.vue";
import Fact from "src/components/Fact/Fact.vue";
import Panel from "src/components/Panel/Panel.vue";
import ControlButton from "src/components/Simulation/ControlButton.vue";
import ControlGroup from "src/components/Simulation/ControlGroup.vue";

type Props = { lab: ReleaseLab };

const SKIP = 10_000;

const props = defineProps<Props>();
const world = useObservable(props.lab.world);
const draft = useObservable(props.lab.draft);
const { controls } = props.lab;

const answerHolds = computed(() => {
  const { expiresAt } = world.value;

  if (expiresAt === null) {
    return "none yet";
  }

  return formatClockTime(expiresAt);
});
</script>

<template>
  <Panel
    title="Simulated world"
    icon="flask"
    shows="A scripted release service, a deployment and a browser. Beacon only ever sees them through its source, its readers and its mechanism."
  >
    <template #aside><Badge tone="warning">Simulation</Badge></template>
    <ControlGroup label="Release service">
      <ControlButton @press="controls.publish()">
        Publish a newer build
      </ControlButton>
      <ControlButton @press="controls.publishRequired()">
        Publish a required build
      </ControlButton>
      <ControlButton @press="controls.rollBack()">Roll back</ControlButton>
      <ControlButton @press="controls.noUpdate()">
        Return no update
      </ControlButton>
      <ControlButton @press="controls.endRunning()">
        End the running build
      </ControlButton>
    </ControlGroup>
    <ControlGroup label="Service health">
      <ControlButton
        :pressed="world.failing"
        @press="controls.setFailing(!world.failing)"
      >
        Fail the manifest
      </ControlButton>
      <ControlButton
        :pressed="world.slow"
        @press="controls.setSlow(!world.slow)"
      >
        Slow manifest
      </ControlButton>
      <ControlButton
        :disabled="world.waiting === 0"
        @press="controls.answerHeld()"
      >
        Answer held read
      </ControlButton>
      <ControlButton
        :disabled="world.expiresAt === null"
        @press="controls.expire()"
      >
        Expire the answer
      </ControlButton>
      <ControlButton @press="controls.skip(SKIP)">
        Skip 10 seconds
      </ControlButton>
    </ControlGroup>
    <ControlGroup label="Application and browser">
      <ControlButton
        :pressed="draft.dirty"
        :disabled="draft.locked"
        @press="controls.setDraft(!draft.dirty)"
      >
        Unsaved draft
      </ControlButton>
      <ControlButton
        :pressed="world.lagging"
        @press="controls.setLagging(!world.lagging)"
      >
        Deployment lags
      </ControlButton>
      <ControlButton @press="controls.check('manual')">Check now</ControlButton>
      <ControlButton @press="controls.install()">
        Boot the new build
      </ControlButton>
    </ControlGroup>
    <dl class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Fact
        term="Deployed"
        hint="The build the service names, whatever its order."
      >
        {{ world.deployed }}
      </Fact>
      <Fact
        term="Served"
        hint="What a new document loads; it trails while a deployment lags."
      >
        {{ world.served }}
      </Fact>
      <Fact
        term="Reads in flight"
        hint="Started and not answered, the ones nobody waits for excluded."
      >
        {{ world.waiting }}
      </Fact>
      <Fact
        term="Answer holds until"
        hint="The expiry the service sent with its last answer."
      >
        {{ answerHolds }}
      </Fact>
      <Fact
        term="Draft"
        hint="The application's own unsaved work, a participant that refuses a reload."
      >
        {{ formatDraft(draft) }}
      </Fact>
    </dl>
  </Panel>
</template>
