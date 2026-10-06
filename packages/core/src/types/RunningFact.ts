import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";
import type { RunningRelease } from "src/types/RunningRelease";

/**
 * What is known of one running subject. `unconfigured` has no reader,
 * `pending` has one that has not answered yet, and `failed` keeps the reason.
 * A subject that is not `known` is never read as an old version.
 *
 * @example
 * ```ts
 * const { web } = beacon.running.get();
 *
 * if (web.state === "known") {
 *   console.info(web.release.label);
 * }
 * ```
 */
export type RunningFact =
  | { state: "unconfigured" }
  | { state: "pending" }
  | { state: "known"; release: RunningRelease; readAt: number }
  | { state: "failed"; error: BeaconErrorInfo };
