import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";

import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import { boundText } from "src/utils/boundText";
import { isFailureEvent } from "src/utils/isFailureEvent";

// A route, a command and a reason are the application's own words, so they are cut; a number cannot grow.
const boundField = (text: string | null) => {
  if (text === null) {
    return null;
  }

  return boundText(text);
};

/** Copies an event into bounded plain data: only the fields it declares, their text cut to a limit, and whether it is a failure. */
export const copyEvent = (
  event: BeaconDiagnosticEvent,
  id: number,
): RecordedEvent => ({
  id,
  type: event.type,
  timestamp: event.timestamp,
  session: event.session,
  route: boundField(event.route),
  command: boundField(event.command),
  attempt: event.attempt,
  operation: event.operation,
  reason: boundField(event.reason),
  failure: isFailureEvent(event.type),
});
