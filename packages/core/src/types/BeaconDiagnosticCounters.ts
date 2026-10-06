/**
 * Running counts of what Beacon dropped or contained, kept whether or not
 * anyone listens to events.
 *
 * @example
 * ```ts
 * const { lateCallbacks } = beacon.diagnostics.get().counters;
 * ```
 */
export type BeaconDiagnosticCounters = {
  lateCallbacks: number;
  listenerErrors: number;
  cleanupErrors: number;
};
