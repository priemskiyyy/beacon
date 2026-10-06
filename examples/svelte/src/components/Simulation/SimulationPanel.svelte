<script lang="ts">
  import { useDisruption, useObservable } from "@priemskiyyy/beacon-svelte";

  import { formatClockTime } from "example-shared/formatting/formatClockTime";
  import { formatDraft } from "example-shared/formatting/formatDraft";
  import { UNSAVED_DRAFT } from "example-shared/lab/constants/lab";
  import Badge from "src/components/Badge/Badge.svelte";
  import Fact from "src/components/Fact/Fact.svelte";
  import Panel from "src/components/Panel/Panel.svelte";
  import ControlButton from "src/components/Simulation/ControlButton.svelte";
  import ControlGroup from "src/components/Simulation/ControlGroup.svelte";
  import { useLab } from "src/hooks/useLab";

  const SKIP = 10_000;

  const lab = useLab();
  const world = useObservable(lab.world);
  const draft = useObservable(lab.draft);
  const { controls } = lab;

  // The lab registers the draft's own participant in every document. This one is the view's: it asks the draft as this panel shows it, and it leaves with the panel.
  useDisruption({
    name: "draft-view",
    impacts: ["document-replacement"],
    reserve: () => {
      if (draft.current.dirty) {
        return { status: "blocked", code: UNSAVED_DRAFT };
      }

      return { status: "reserved" };
    },
  });
</script>

<Panel
  title="Simulated world"
  icon="flask"
  shows="A scripted release service, a deployment and a browser. Beacon only ever sees them through its source, its readers and its mechanism."
>
  {#snippet aside()}
    <Badge tone="warning">Simulation</Badge>
  {/snippet}
  <ControlGroup label="Release service">
    <ControlButton onPress={controls.publish}
      >Publish a newer build</ControlButton
    >
    <ControlButton onPress={controls.publishRequired}>
      Publish a required build
    </ControlButton>
    <ControlButton onPress={controls.rollBack}>Roll back</ControlButton>
    <ControlButton onPress={controls.noUpdate}>Return no update</ControlButton>
    <ControlButton onPress={controls.endRunning}>
      End the running build
    </ControlButton>
  </ControlGroup>
  <ControlGroup label="Service health">
    <ControlButton
      pressed={world.current.failing}
      onPress={() => controls.setFailing(!world.current.failing)}
    >
      Fail the manifest
    </ControlButton>
    <ControlButton
      pressed={world.current.slow}
      onPress={() => controls.setSlow(!world.current.slow)}
    >
      Slow manifest
    </ControlButton>
    <ControlButton
      disabled={world.current.waiting === 0}
      onPress={controls.answerHeld}
    >
      Answer held read
    </ControlButton>
    <ControlButton
      disabled={world.current.expiresAt === null}
      onPress={controls.expire}
    >
      Expire the answer
    </ControlButton>
    <ControlButton onPress={() => controls.skip(SKIP)}>
      Skip 10 seconds
    </ControlButton>
  </ControlGroup>
  <ControlGroup label="Application and browser">
    <ControlButton
      pressed={draft.current.dirty}
      disabled={draft.current.locked}
      onPress={() => controls.setDraft(!draft.current.dirty)}
    >
      Unsaved draft
    </ControlButton>
    <ControlButton
      pressed={world.current.lagging}
      onPress={() => controls.setLagging(!world.current.lagging)}
    >
      Deployment lags
    </ControlButton>
    <ControlButton onPress={() => controls.check("manual")}>
      Check now
    </ControlButton>
    <ControlButton onPress={controls.install}>Boot the new build</ControlButton>
  </ControlGroup>
  <dl class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    <Fact
      term="Deployed"
      hint="The build the service names, whatever its order."
    >
      {world.current.deployed}
    </Fact>
    <Fact
      term="Served"
      hint="What a new document loads; it trails while a deployment lags."
    >
      {world.current.served}
    </Fact>
    <Fact
      term="Reads in flight"
      hint="Started and not answered, the ones nobody waits for excluded."
    >
      {world.current.waiting}
    </Fact>
    <Fact
      term="Answer holds until"
      hint="The expiry the service sent with its last answer."
    >
      {world.current.expiresAt === null
        ? "none yet"
        : formatClockTime(world.current.expiresAt)}
    </Fact>
    <Fact
      term="Draft"
      hint="The application's own unsaved work, a participant that refuses a reload."
    >
      {formatDraft(draft.current)}
    </Fact>
  </dl>
</Panel>
