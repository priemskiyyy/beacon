import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatDiagnosticEvent } from "example-shared/formatting/formatDiagnosticEvent";
import type { EventLog } from "example-shared/types/EventLog";
import { Button } from "src/components/Button/Button";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Panel } from "src/components/Panel/Panel";
import { useEventLog } from "src/hooks/useEventLog";

type NativeTimelinePanelProps = {
  diagnostics: EventLog<BeaconDiagnosticEvent>;
};

export const NativeTimelinePanel: React.FunctionComponent<
  NativeTimelinePanelProps
> = ({ diagnostics }) => {
  const events = useEventLog(diagnostics);

  return (
    <Panel
      title="Timeline"
      shows="Beacon's diagnostics, newest first."
      aside={
        <Button label="Clear" variant="ghost" onPress={diagnostics.clear} />
      }
    >
      {events.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="The startup check appears here."
        />
      ) : (
        <View testID="timeline">
          {events.map((event, index) => (
            <View key={`${event.timestamp}-${index}`} style={styles.row}>
              <Text style={styles.time}>
                {formatClockTime(event.timestamp)}
              </Text>
              <Text style={styles.text}>{formatDiagnosticEvent(event)}</Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  time: { fontFamily: "monospace", fontSize: 12, color: "#71717a" },
  text: { flexShrink: 1, fontSize: 13, color: "#27272a" },
});
