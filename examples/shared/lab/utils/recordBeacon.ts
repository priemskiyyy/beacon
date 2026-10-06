import type { TimelineBody } from "example-shared/lab/types/TimelineBody";
import type { LabBeacon } from "example-shared/lab/types/LabBeacon";

type RecordBeaconOptions = {
  beacon: LabBeacon;
  record: (body: TimelineBody, at?: number) => void;
};

/**
 * Listens to what Beacon says about itself: its diagnostic events, from the
 * moment they are subscribed to, and every change of the journal's state.
 * Answers how to stop.
 */
export const recordBeacon = ({ beacon, record }: RecordBeaconOptions) => {
  const stopDiagnostics = beacon.diagnostics.events.subscribe((event) =>
    record({ source: "diagnostic", event }, event.timestamp),
  );

  const stopTransitions = beacon.transitions.subscribe(() =>
    record({ source: "transition", state: beacon.transitions.get() }),
  );

  return () => {
    stopDiagnostics();
    stopTransitions();
  };
};
