import type React from "react";
import { View } from "react-native";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { Button } from "src/components/Button/Button";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Panel } from "src/components/Panel/Panel";
import { TimelineRow } from "src/components/Timeline/TimelineRow";
import { useEventLog } from "src/hooks/useEventLog";

type TimelinePanelProps = { lab: ReleaseLab };

export const TimelinePanel: React.FunctionComponent<TimelinePanelProps> = ({
  lab,
}) => {
  const entries = useEventLog(lab.timeline);

  return (
    <Panel
      title="Timeline"
      shows="Beacon's diagnostics, the journal's changes and what the world did, newest first."
      aside={
        <Button label="Clear" variant="ghost" onPress={lab.timeline.clear} />
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Check, publish or reload, and each step appears here."
        />
      ) : (
        <View testID="timeline">
          {entries.map((entry) => (
            <TimelineRow key={entry.id} entry={entry} />
          ))}
        </View>
      )}
    </Panel>
  );
};
