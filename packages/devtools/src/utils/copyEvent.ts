import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";

import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import { formatValueText } from "src/formatting/formatValueText";
import { boundText } from "src/utils/boundText";
import { inspectCause } from "src/utils/inspectCause";
import { isFailureEvent } from "src/utils/isFailureEvent";

// A route, a command and a reason are the application's own words, so they are cut; a number cannot grow.
const boundField = (text: string | null) => {
  if (text === null) {
    return null;
  }

  return boundText(text);
};

// What a failure threw is inspected the way a provider's native handle is, so the panel shows the words of an error and never walks an object of the application's.
const describeCause = (cause: unknown) => {
  if (cause === null) {
    return null;
  }

  return formatValueText(inspectCause(cause));
};

/** Copies an event into bounded plain data: only the fields it declares, their text cut to a limit, what a failure threw as inspected text, and whether it is a failure. */
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
  cause: describeCause(event.cause),
  failure: isFailureEvent(event.type),
});
