import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";

import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import { boundText } from "src/utils/boundText";
import { isFailureEvent } from "src/utils/isFailureEvent";

// An event is typed, but a value that reaches the panel is read as what it is.
const readText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  return boundText(value);
};

const readNumber = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

/** Copies an event into bounded plain data: text cut to a limit, numbers that are numbers, and whether it is a failure. */
export const copyEvent = (
  event: BeaconDiagnosticEvent,
  id: number,
): RecordedEvent => {
  const type = readText(event.type) ?? "unknown";

  return {
    id,
    type,
    timestamp: readNumber(event.timestamp) ?? 0,
    session: readNumber(event.session),
    route: readText(event.route),
    command: readText(event.command),
    attempt: readNumber(event.attempt),
    operation: readNumber(event.operation),
    reason: readText(event.reason),
    failure: isFailureEvent(type),
  };
};
