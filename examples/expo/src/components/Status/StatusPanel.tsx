import {
  useRoute,
  useRunning,
  useStatus,
  useSupport,
} from "@priemskiyyy/beacon-react";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatCheck } from "example-shared/formatting/formatCheck";
import { formatObservation } from "example-shared/formatting/formatObservation";
import { formatRunningFact } from "example-shared/formatting/formatRunningFact";
import { formatSupport } from "example-shared/formatting/formatSupport";
import {
  CHECK_TONES,
  OBSERVATION_TONES,
  OPERATION_TONES,
  RUNNING_TONES,
  SESSION_TONES,
  SUPPORT_TONES,
} from "example-shared/ui/constants/tones";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";

type StatusPanelProps = { runtime: string };

export const StatusPanel: React.FunctionComponent<StatusPanelProps> = ({
  runtime,
}) => {
  const status = useStatus();
  const { check, observation, operation } = useRoute("web");
  const web = useRunning(({ web: fact }) => fact);
  const boot = useRunning(({ boot: identity }) => identity.id);
  const support = useSupport();

  return (
    <Panel
      title="Status"
      shows="Each fact says what it knows and no more. A missing one is pending or unknown, never an old version."
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
          term="Operation"
          value={operation.state}
          tone={OPERATION_TONES[operation.state]}
          testID="operation"
        />
        <Fact
          term="Running"
          value={formatRunningFact(web)}
          tone={RUNNING_TONES[web.state]}
          testID="running"
        />
        <Fact
          term="Support"
          value={formatSupport(support)}
          tone={SUPPORT_TONES[support.status]}
          testID="support"
        />
      </View>
      <Text testID="boot" style={styles.detail}>
        {boot}
      </Text>
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
