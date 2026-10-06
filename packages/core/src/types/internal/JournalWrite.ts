import type { BeaconError } from "src/utils/BeaconError";

/** How persisting an intent went, and so whether its command may be dispatched. */
export type JournalWrite =
  | { status: "skipped" }
  | { status: "written" }
  | { status: "degraded" }
  | { status: "failed"; error: BeaconError };
