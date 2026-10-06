import type { BeaconClock } from "src/types/BeaconClock";
import type { JournalOptions } from "src/types/JournalOptions";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningReaders } from "src/types/RunningReaders";
import type { SupportPolicy } from "src/types/SupportPolicy";

/**
 * What one Beacon observes: the scope its authorities speak for, the named
 * routes, and the local readers of what is running, which a feed route needs
 * one of for the subject of its mechanism. Every field is read once, at
 * construction, and nothing starts until `start()`.
 *
 * @example
 * ```ts
 * const options: BeaconOptions<{ web: typeof web }> = {
 *   scope: { application: "com.example.notes", environment: "production", platform: "web", distribution: "public-web" },
 *   running: { web: readWebRelease },
 *   routes: { web },
 *   journal: { storage },
 *   timeouts: { check: 5_000, journal: 2_000 },
 * };
 * ```
 */
export type BeaconOptions<TRoutes extends Record<string, RouteDefinition>> = {
  scope: ReleaseScope;
  routes: TRoutes;
  /** The local readers of what runs, one per subject; left out, a driver route supplies the reader of its own subject and the boot id is the realm's. */
  running?: RunningReaders;
  /** The support policy, if the application has one; it may only name routes of this Beacon. */
  policy?: SupportPolicy<unknown, unknown, keyof TRoutes & string>;
  timeouts?: {
    /** Milliseconds a running fact may take to be read, 10,000 by default. */
    running?: number;
    /** Milliseconds a check may take to be answered, 10,000 by default. */
    check?: number;
    /** Milliseconds a participant may take to settle before a command, 10,000 by default. */
    settlement?: number;
    /** Milliseconds a call to the journal's storage may take, 10,000 by default. */
    journal?: number;
  };
  /** Turns the transition journal on; it is off by default, and then no intent is written. */
  journal?: JournalOptions;
  clock?: BeaconClock;
};
