import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";

/**
 * The latest check attempt of a route. `succeeded` means an authority
 * answered and the answer was accepted, not that an update exists, and a
 * failure never rewrites the observation, the prepared state or an operation.
 * `attempt` is the number shared by everyone who joined the same read.
 *
 * @example
 * ```ts
 * const { check } = beacon.route("web").state.get();
 *
 * if (check.state === "failed") {
 *   console.warn(check.error.code);
 * }
 * ```
 */
export type CheckState =
  | { state: "idle" }
  | { state: "checking"; attempt: number; startedAt: number }
  | {
      state: "succeeded";
      attempt: number;
      startedAt: number;
      settledAt: number;
    }
  | {
      state: "failed";
      attempt: number;
      startedAt: number;
      settledAt: number;
      error: BeaconErrorInfo;
    };
