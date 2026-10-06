import { useObservable } from "@priemskiyyy/beacon-react";
import type React from "react";
import { StyleSheet, View } from "react-native";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatDraft } from "example-shared/formatting/formatDraft";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { Badge } from "src/components/Badge/Badge";
import { Button } from "src/components/Button/Button";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";

type SimulationPanelProps = { lab: ReleaseLab };

const SKIP = 10_000;

const toggle = (on: boolean) => {
  if (on) {
    return "primary";
  }

  return "ghost";
};

export const SimulationPanel: React.FunctionComponent<SimulationPanelProps> = ({
  lab,
}) => {
  const world = useObservable(lab.world);
  const draft = useObservable(lab.draft);
  const { controls } = lab;

  return (
    <Panel
      title="Simulated world"
      shows="A scripted release service, a deployment and a browser. Nothing here comes from the device."
      aside={<Badge tone="warning">Simulation</Badge>}
    >
      <View style={styles.choices}>
        <Button
          label="Publish a newer build"
          onPress={controls.publish}
          variant="ghost"
        />
        <Button
          label="Publish a required build"
          onPress={controls.publishRequired}
          variant="ghost"
        />
        <Button label="Roll back" onPress={controls.rollBack} variant="ghost" />
        <Button
          label="Return no update"
          onPress={controls.noUpdate}
          variant="ghost"
        />
        <Button
          label="End the running build"
          onPress={controls.endRunning}
          variant="ghost"
        />
      </View>
      <View style={styles.choices}>
        <Button
          label="Fail the manifest"
          variant={toggle(world.failing)}
          onPress={() => controls.setFailing(!world.failing)}
        />
        <Button
          label="Slow manifest"
          variant={toggle(world.slow)}
          onPress={() => controls.setSlow(!world.slow)}
        />
        <Button
          label="Answer held read"
          variant="ghost"
          disabled={world.waiting === 0}
          onPress={controls.answerHeld}
        />
        <Button
          label="Expire the answer"
          variant="ghost"
          disabled={world.expiresAt === null}
          onPress={controls.expire}
        />
        <Button
          label="Skip 10 seconds"
          variant="ghost"
          onPress={() => controls.skip(SKIP)}
        />
      </View>
      <View style={styles.choices}>
        <Button
          label="Unsaved draft"
          variant={toggle(draft.dirty)}
          disabled={draft.locked}
          onPress={() => controls.setDraft(!draft.dirty)}
        />
        <Button
          label="Deployment lags"
          variant={toggle(world.lagging)}
          onPress={() => controls.setLagging(!world.lagging)}
        />
        <Button
          label="Check now"
          variant="ghost"
          onPress={() => controls.check("manual")}
        />
        <Button label="Boot the new build" onPress={controls.install} />
      </View>
      <View style={styles.facts}>
        <Fact
          term="Deployed"
          value={String(world.deployed)}
          tone="neutral"
          testID="deployed"
        />
        <Fact
          term="Served"
          value={String(world.served)}
          tone="neutral"
          testID="served"
        />
        <Fact
          term="Reads in flight"
          value={String(world.waiting)}
          tone="neutral"
          testID="waiting"
        />
        <Fact
          term="Answer holds until"
          value={
            world.expiresAt === null
              ? "none yet"
              : formatClockTime(world.expiresAt)
          }
          tone="neutral"
          testID="expires"
        />
        <Fact
          term="Draft"
          value={formatDraft(draft)}
          tone={draft.dirty ? "warning" : "neutral"}
          testID="draft"
        />
      </View>
    </Panel>
  );
};

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
