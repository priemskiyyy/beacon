import { useObservable } from "@priemskiyyy/beacon-react";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatCheck } from "example-shared/formatting/formatCheck";
import { formatObservation } from "example-shared/formatting/formatObservation";
import { formatRunningFact } from "example-shared/formatting/formatRunningFact";
import { formatSupport } from "example-shared/formatting/formatSupport";
import { formatTransitionState } from "example-shared/formatting/formatTransitionState";
import {
  CHECK_TONES,
  JOURNAL_TONES,
  OBSERVATION_TONES,
  RUNNING_TONES,
  SESSION_TONES,
  SUPPORT_TONES,
} from "example-shared/ui/constants/tones";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";
import type { NativeBeacon } from "src/lab/types/NativeBeacon";

type NativeStatusPanelProps = { beacon: NativeBeacon; runtime: string };

export const NativeStatusPanel: React.FunctionComponent<
  NativeStatusPanelProps
> = ({ beacon, runtime }) => {
  const status = useObservable(beacon.status);
  const { check, observation } = useObservable(beacon.route("ota").state);
  const bundle = useObservable(beacon.running, ({ bundle: fact }) => fact);
  const native = useObservable(beacon.running, ({ native: fact }) => fact);
  const transitions = useObservable(beacon.transitions);
  const support = useObservable(beacon.support);

  return (
    <Panel
      title="Status"
      shows="The provider's check is mapped in full: updates disabled in development is unknown, never no update."
    >
      <View style={styles.facts}>
        <Fact
          term="Session"
          value={status.state}
          tone={SESSION_TONES[status.state]}
          testID="session"
        />
        <Fact
          term="Check"
          value={formatCheck(check)}
          tone={CHECK_TONES[check.state]}
          testID="check"
        />
        <Fact
          term="Observation"
          value={formatObservation(observation)}
          tone={OBSERVATION_TONES[observation.status]}
          testID="observation"
        />
        <Fact
          term="Running bundle"
          value={formatRunningFact(bundle)}
          tone={RUNNING_TONES[bundle.state]}
          testID="running"
        />
        <Fact
          term="Installed binary"
          value={formatRunningFact(native)}
          tone={RUNNING_TONES[native.state]}
          testID="native"
        />
        <Fact
          term="Journal"
          value={formatTransitionState(transitions)}
          tone={JOURNAL_TONES[transitions.journal]}
          testID="journal"
        />
        <Fact
          term="Support"
          value={formatSupport(support)}
          tone={SUPPORT_TONES[support.status]}
          testID="support"
        />
      </View>
      <Text testID="runtime" style={styles.detail}>
        {runtime}
      </Text>
    </Panel>
  );
};

const styles = StyleSheet.create({
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detail: { fontFamily: "monospace", fontSize: 12, color: "#71717a" },
});
