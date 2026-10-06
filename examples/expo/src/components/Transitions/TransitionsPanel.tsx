import { useBeacon, useTransitions } from "@priemskiyyy/beacon-react";
import type React from "react";
import { StyleSheet, View } from "react-native";

import { formatIdentity } from "example-shared/formatting/formatIdentity";
import {
  JOURNAL_TONES,
  RECONCILIATION_TONES,
} from "example-shared/ui/constants/tones";
import { Button } from "src/components/Button/Button";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";

export const TransitionsPanel: React.FunctionComponent = () => {
  const beacon = useBeacon();
  const { journal, latest, checkpoints } = useTransitions();

  return (
    <Panel
      title="Transitions"
      shows="The intent written before a reload, and what the next boot says about it. Never proof that anything was installed."
    >
      <View style={styles.facts}>
        <Fact
          term="Journal"
          value={journal}
          tone={JOURNAL_TONES[journal]}
          testID="journal"
        />
        <Fact
          term="Latest intent"
          value={
            latest === null
              ? "none recorded"
              : `${latest.intent.command} aimed at ${formatIdentity(latest.intent.target ?? { status: "unknown", reason: "no-target" })}`
          }
          tone="neutral"
          testID="intent"
        />
        <Fact
          term="Outcome"
          value={latest === null ? "nothing to reconcile" : latest.outcome}
          tone={
            latest === null ? "neutral" : RECONCILIATION_TONES[latest.outcome]
          }
          testID="reconciliation"
        />
        <Fact
          term="Unreached boots"
          value={latest === null ? "0" : String(latest.attempts)}
          tone={latest?.exhausted === true ? "danger" : "neutral"}
          testID="attempts"
        />
        <Fact
          term="Checkpoints"
          value={
            checkpoints.length === 0 ? "none reported" : checkpoints.join(", ")
          }
          tone="neutral"
          testID="checkpoints"
        />
      </View>
      <View style={styles.facts}>
        <Button
          label="Report ready"
          variant="ghost"
          onPress={() => beacon.reportReady({ checkpoint: "primary-screen" })}
        />
        <Button
          label="Clear journal"
          variant="ghost"
          onPress={() => beacon.clearJournal()}
        />
      </View>
    </Panel>
  );
};

const styles = StyleSheet.create({
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
