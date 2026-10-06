import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";

/**
 * One frozen record of something Beacon did. It names sessions, routes,
 * attempts and operations by number and name, and a short `reason` code,
 * never a URL, a manifest, a release note, a credential or a provider
 * payload. Its order is the local order of events, not a deployment revision.
 *
 * The one exception is `cause`, on the events that report a failure
 * (`read-failed`, `running-failed`, `route-failed`, `policy-failed`,
 * `journal-failed` and `command-settled` for a command that failed): the raw
 * value that was thrown, which can hold a URL or a provider payload. It exists
 * only in the event, which is only built while someone listens, and never in a
 * snapshot, an outcome, a counter or an error's published info. A listener
 * that forwards events to telemetry must drop it.
 *
 * @example
 * ```ts
 * beacon.diagnostics.events.subscribe((event) => {
 *   if (event.cause !== null) {
 *     console.warn(event.type, event.reason, event.cause);
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
  /** The command, by name, or `null`. */
  command: string | null;
  attempt: number | null;
  operation: number | null;
  /** Why it happened, such as `obsolete` or an error code. */
  reason: string | null;
  /** The raw value a failure threw, or `null` when nothing was thrown or the event reports no failure. Never forward it to telemetry. */
  cause: unknown;
};
