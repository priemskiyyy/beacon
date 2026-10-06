import { formatIsoTime } from "src/formatting/formatIsoTime";
import { formatValueText } from "src/formatting/formatValueText";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";

/** The text an expanded row shows and its copy button copies: every field of the event, the time as UTC, and what a failure threw after them. */
export const formatEventText = (event: RecordedEvent) => {
  const fields = formatValueText({
    type: event.type,
    time: formatIsoTime(event.timestamp),
    session: event.session,
    route: event.route,
    command: event.command,
    attempt: event.attempt,
    operation: event.operation,
    reason: event.reason,
  });

  if (event.cause === null) {
    return fields;
  }

  return `${fields}\n\ncause\n${event.cause}`;
};
