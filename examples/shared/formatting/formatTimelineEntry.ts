import { match } from "ts-pattern";

import { formatDiagnosticEvent } from "example-shared/formatting/formatDiagnosticEvent";
import { formatTransitionState } from "example-shared/formatting/formatTransitionState";
import { formatWorldEvent } from "example-shared/formatting/formatWorldEvent";
import type { TimelineEntry } from "example-shared/lab/types/TimelineEntry";

/** One timeline entry in plain words. */
export const formatTimelineEntry = (entry: TimelineEntry) =>
  match(entry)
    .with({ source: "diagnostic" }, ({ event }) => formatDiagnosticEvent(event))
    .with({ source: "transition" }, ({ state }) => formatTransitionState(state))
    .with({ source: "world" }, ({ event }) => formatWorldEvent(event))
    .exhaustive();
