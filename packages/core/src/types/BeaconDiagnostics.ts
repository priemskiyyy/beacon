import type { BeaconDiagnosticEvent } from "src/types/BeaconDiagnosticEvent";
import type { BeaconDiagnosticSnapshot } from "src/types/BeaconDiagnosticSnapshot";
import type { ObservableValue } from "src/types/ObservableValue";

/**
 * A passive view for logs and devtools: the current snapshot as an
 * observable, and a stream of events that never replays. Observing either
 * starts nothing, and events are only built while someone listens.
 *
 * @example
 * ```ts
 * const stop = beacon.diagnostics.events.subscribe((event) => console.debug(event.type));
 * ```
 */
export type BeaconDiagnostics = ObservableValue<BeaconDiagnosticSnapshot> & {
  events: {
    subscribe: (listener: (event: BeaconDiagnosticEvent) => void) => () => void;
  };
};
