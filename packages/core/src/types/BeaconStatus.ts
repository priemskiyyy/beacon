/**
 * Where the observation session stands: `idle` before the first `start()`,
 * `running` while the session is open, `stopped` after `stop()`, and
 * `disposed` for good. It says nothing about any release.
 *
 * @example
 * ```ts
 * const active = beacon.status.get().state === "running";
 * ```
 */
export type BeaconStatus =
  | { state: "idle" }
  | { state: "running"; session: number }
  | { state: "stopped" }
  | { state: "disposed" };
