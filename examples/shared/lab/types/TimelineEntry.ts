import type { TimelineBody } from "example-shared/lab/types/TimelineBody";

/** One line of the timeline; `boot` is the document that was running when it happened. */
export type TimelineEntry = { id: number; at: number; boot: number } & TimelineBody;
