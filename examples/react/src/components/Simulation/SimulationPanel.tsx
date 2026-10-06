import { Flask } from "@phosphor-icons/react";
import { useObservable } from "@priemskiyyy/beacon-react";
import type React from "react";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatDraft } from "example-shared/formatting/formatDraft";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { Badge } from "src/components/Badge/Badge";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";
import { ControlButton } from "src/components/Simulation/ControlButton";
import { ControlGroup } from "src/components/Simulation/ControlGroup";

type SimulationPanelProps = { lab: ReleaseLab };

const SKIP = 10_000;

export const SimulationPanel: React.FunctionComponent<SimulationPanelProps> = ({
  lab,
}) => {
  const world = useObservable(lab.world);
  const draft = useObservable(lab.draft);
  const { controls } = lab;

  return (
    <Panel
      title="Simulated world"
      icon={Flask}
      shows="A scripted release service, a deployment and a browser. Beacon only ever sees them through its source, its readers and its mechanism."
      aside={<Badge tone="warning">Simulation</Badge>}
    >
      <ControlGroup label="Release service">
        <ControlButton onPress={controls.publish}>
          Publish a newer build
        </ControlButton>
        <ControlButton onPress={controls.publishRequired}>
          Publish a required build
        </ControlButton>
        <ControlButton onPress={controls.rollBack}>Roll back</ControlButton>
        <ControlButton onPress={controls.noUpdate}>
          Return no update
        </ControlButton>
        <ControlButton onPress={controls.endRunning}>
          End the running build
        </ControlButton>
      </ControlGroup>
      <ControlGroup label="Service health">
        <ControlButton
          pressed={world.failing}
          onPress={() => controls.setFailing(!world.failing)}
        >
          Fail the manifest
        </ControlButton>
        <ControlButton
          pressed={world.slow}
          onPress={() => controls.setSlow(!world.slow)}
        >
          Slow manifest
        </ControlButton>
        <ControlButton
          disabled={world.waiting === 0}
          onPress={controls.answerHeld}
        >
          Answer held read
        </ControlButton>
        <ControlButton
          disabled={world.expiresAt === null}
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
          pressed={draft.dirty}
          disabled={draft.locked}
          onPress={() => controls.setDraft(!draft.dirty)}
        >
          Unsaved draft
        </ControlButton>
        <ControlButton
          pressed={world.lagging}
          onPress={() => controls.setLagging(!world.lagging)}
        >
          Deployment lags
        </ControlButton>
        <ControlButton onPress={() => controls.check("manual")}>
          Check now
        </ControlButton>
        <ControlButton onPress={controls.install}>
          Boot the new build
        </ControlButton>
      </ControlGroup>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          term="Deployed"
          hint="The build the service names, whatever its order."
        >
          {world.deployed}
        </Fact>
        <Fact
          term="Served"
          hint="What a new document loads; it trails while a deployment lags."
        >
          {world.served}
        </Fact>
        <Fact
          term="Reads in flight"
          hint="Started and not answered, the ones nobody waits for excluded."
        >
          {world.waiting}
        </Fact>
        <Fact
          term="Answer holds until"
          hint="The expiry the service sent with its last answer."
        >
          {world.expiresAt === null
            ? "none yet"
            : formatClockTime(world.expiresAt)}
        </Fact>
        <Fact
          term="Draft"
          hint="The application's own unsaved work, a participant that refuses a reload."
        >
          {formatDraft(draft)}
        </Fact>
      </dl>
    </Panel>
  );
};
