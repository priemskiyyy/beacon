import type { EventFilters } from "src/types/internal/EventFilters";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";

const describeEvent = (event: RecordedEvent) =>
  [
    event.type,
    event.session === null ? "" : `session ${event.session}`,
    event.route,
    event.command,
    event.attempt === null ? "" : `attempt ${event.attempt}`,
    event.operation === null ? "" : `operation ${event.operation}`,
    event.reason,
  ]
    .join(" ")
    .toLowerCase();

/** The events one route, one type and a search leave visible. Events of no route stay when a route is selected: a stopped session is often why its route did nothing. */
export const filterEvents = (
  events: RecordedEvent[],
  filters: EventFilters,
) => {
  const query = filters.query.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.type !== null && event.type !== filters.type) {
      return false;
    }

    if (
      filters.route !== null &&
      event.route !== null &&
      event.route !== filters.route
    ) {
      return false;
    }

    return describeEvent(event).includes(query);
  });
};
