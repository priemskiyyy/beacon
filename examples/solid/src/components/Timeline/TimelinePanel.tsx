import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Icon } from "src/components/Icon/Icon";
import { Panel } from "src/components/Panel/Panel";
import { TimelineRow } from "src/components/Timeline/TimelineRow";
import { useEventLog } from "src/hooks/useEventLog";

type TimelinePanelProps = { lab: ReleaseLab };

export const TimelinePanel: Component<TimelinePanelProps> = (props) => {
  const entries = useEventLog(props.lab.timeline);

  return (
    <Panel
      title="Timeline"
      icon="clock"
      shows="Beacon's diagnostics, the journal's changes and what the world did, newest first. A diagnostic names counts and codes, never a manifest or a URL."
      aside={
        <button
          type="button"
          onClick={props.lab.timeline.clear}
          class={buttonStyles({ size: "small", variant: "ghost" })}
        >
          <Icon name="trash" size={14} />
          Clear
        </button>
      }
    >
      <Show
        when={entries().length > 0}
        fallback={
          <EmptyState
            icon="clock"
            title="Nothing recorded yet"
            description="Check, publish or reload, and each step appears here."
          />
        }
      >
        <ol
          aria-label="Timeline entries"
          class="flex max-h-[28rem] flex-col divide-y divide-zinc-200/70 overflow-y-auto text-sm dark:divide-zinc-800"
        >
          <For each={entries()}>{(entry) => <TimelineRow entry={entry} />}</For>
        </ol>
      </Show>
    </Panel>
  );
};
