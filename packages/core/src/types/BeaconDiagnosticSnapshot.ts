import type { BeaconDiagnosticCounters } from "src/types/BeaconDiagnosticCounters";
import type { BeaconStatus } from "src/types/BeaconStatus";

/**
 * What Beacon holds right now, without any scope, URL, manifest or provider
 * payload: where the session stands and what was contained.
 *
 * @example
 * ```ts
 * const { status, session } = beacon.diagnostics.get();
 * ```
 */
export type BeaconDiagnosticSnapshot = {
  status: BeaconStatus["state"];
  /** The number of the open session, or `null`. */
  session: number | null;
  counters: BeaconDiagnosticCounters;
};
