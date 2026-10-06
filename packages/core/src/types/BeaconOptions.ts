import type { BeaconClock } from "src/types/BeaconClock";
import type { RunningReaders } from "src/types/RunningReaders";

/**
 * What one Beacon observes. Every field is read once, at construction, and
 * nothing starts until `start()`.
 *
 * @example
 * ```ts
 * const options: BeaconOptions = {
 *   running: { boot: { id: BOOT_ID }, web: readWebRelease },
 *   timeouts: { running: 5_000 },
 * };
 * ```
 */
export type BeaconOptions = {
  running: RunningReaders;
  timeouts?: {
    /** Milliseconds a running fact may take to be read, 10,000 by default. */
    running?: number;
  };
  clock?: BeaconClock;
};
