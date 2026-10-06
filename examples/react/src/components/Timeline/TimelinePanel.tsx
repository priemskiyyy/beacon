import { ClockCounterClockwise, Trash } from "@phosphor-icons/react";
import type React from "react";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
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
      icon={ClockCounterClockwise}
      shows="Beacon's diagnostics, the journal's changes and what the world did, newest first. A diagnostic names counts and codes, never a manifest or a URL."
      aside={
        <button
          type="button"
          onClick={lab.timeline.clear}
          className={buttonStyles({ size: "small", variant: "ghost" })}
        >
          <Trash aria-hidden="true" size={14} weight="bold" />
          Clear
        </button>
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          icon={ClockCounterClockwise}
          title="Nothing recorded yet"
          description="Check, publish or reload, and each step appears here."
        />
      ) : (
        <ol
          aria-label="Timeline entries"
          className="flex max-h-[28rem] flex-col divide-y divide-zinc-200/70 overflow-y-auto text-sm dark:divide-zinc-800"
        >
          {entries.map((entry) => (
            <TimelineRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </Panel>
  );
};
