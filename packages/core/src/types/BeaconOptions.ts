import type { BeaconClock } from "src/types/BeaconClock";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningReaders } from "src/types/RunningReaders";
import type { SupportPolicy } from "src/types/SupportPolicy";

/**
 * What one Beacon observes: the scope its authorities speak for, the local
 * readers of what is running, and the named routes. Every field is read once,
 * at construction, and nothing starts until `start()`.
 *
 * @example
 * ```ts
 * const options: BeaconOptions<{ web: typeof web }> = {
 *   scope: { application: "com.example.notes", environment: "production", platform: "web", distribution: "public-web" },
 *   running: { boot: { id: BOOT_ID }, web: readWebRelease },
 *   routes: { web },
 *   timeouts: { check: 5_000 },
 * };
 * ```
 */
export type BeaconOptions<TRoutes extends Record<string, RouteDefinition>> = {
  scope: ReleaseScope;
  running: RunningReaders;
  routes: TRoutes;
  /** The support policy, if the application has one; it may only name routes of this Beacon. */
  policy?: SupportPolicy<unknown, unknown, keyof TRoutes & string>;
  timeouts?: {
    /** Milliseconds a running fact may take to be read, 10,000 by default. */
    running?: number;
    /** Milliseconds a check may take to be answered, 10,000 by default. */
    check?: number;
    /** Milliseconds a participant may take to settle before a command, 10,000 by default. */
    settlement?: number;
  };
  clock?: BeaconClock;
};
