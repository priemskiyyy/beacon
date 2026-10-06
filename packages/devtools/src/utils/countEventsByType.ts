import type { RecordedEvent } from "src/types/internal/RecordedEvent";

/** How many events of each type were recorded, for the chips. */
export const countEventsByType = (events: RecordedEvent[]) => {
  const counts = new Map<string, number>();

  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }

  return counts;
};
