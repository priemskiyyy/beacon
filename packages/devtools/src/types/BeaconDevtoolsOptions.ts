import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";

/**
 * Options of `BeaconDevtools`: the Beacon to inspect and how the panel starts.
 * Typing the Beacon down to what the inspector reads is what keeps it passive:
 * it has no `start`, `stop`, `dispose`, `replaceScope` and no route command to
 * call, only `check`.
 *
 * @example
 * ```ts
 * const options: BeaconDevtoolsOptions = { beacon, initialIsOpen: true, maxEvents: 500 };
 * ```
 */
export type BeaconDevtoolsOptions = {
  /** The Beacon to inspect. Its snapshots, its diagnostics and its `check` are all that is ever used. */
  beacon: ObservedBeacon;
  /** Opens the panel on the first visit. Later visits restore the last open state. */
  initialIsOpen?: boolean;
  /** Events kept in memory. Defaults to 200, clamped to 1 to 1000. */
  maxEvents?: number;
};
