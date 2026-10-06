import type { Component } from "solid-js";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatTimelineEntry } from "example-shared/formatting/formatTimelineEntry";
import { TIMELINE_SOURCE_LABELS } from "example-shared/lab/constants/labels";
import type { TimelineEntry } from "example-shared/lab/types/TimelineEntry";
import { TIMELINE_SOURCE_TONES } from "example-shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";

type TimelineRowProps = { entry: TimelineEntry };

export const TimelineRow: Component<TimelineRowProps> = (props) => (
  <li class="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 py-2">
    <time
      datetime={new Date(props.entry.at).toISOString()}
      class="font-mono text-xs text-zinc-500 tabular-nums"
    >
      {formatClockTime(props.entry.at)}
    </time>
    <span class="flex min-w-0 flex-wrap items-center gap-2">
      <Badge tone={TIMELINE_SOURCE_TONES[props.entry.source]}>
        {TIMELINE_SOURCE_LABELS[props.entry.source]}
      </Badge>
      <span class="min-w-0 break-words">
        {formatTimelineEntry(props.entry)}
      </span>
      <span class="font-mono text-xs text-zinc-400">
        doc {props.entry.boot}
      </span>
    </span>
  </li>
);
