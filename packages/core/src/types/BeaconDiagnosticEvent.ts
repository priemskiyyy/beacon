import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";

/**
 * One frozen record of something Beacon did. It names sessions, routes,
 * attempts and operations by number and name, and a short `reason` code,
 * never a URL, a manifest, a release note, a credential or a provider
 * payload. Its order is the local order of events, not a deployment revision.
 *
 * @example
 * ```ts
 * beacon.diagnostics.events.subscribe((event) => {
 *   if (event.type === "late-callback") {
 *     console.debug(event.route, event.reason);
 *   }
 * });
 * ```
 */
export type BeaconDiagnosticEvent = {
  type: BeaconDiagnosticEventType;
  /** Epoch milliseconds on the Beacon clock. */
  timestamp: number;
  /** The number of the session, or `null` outside one. */
  session: number | null;
  /** The route, by name, or `null`. */
  route: string | null;
  attempt: number | null;
  operation: number | null;
  /** Why it happened, such as `obsolete` or an error code. */
  reason: string | null;
};
