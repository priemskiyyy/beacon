import { createMemo, createSignal } from "solid-js";
import type { Accessor } from "solid-js";

import type { EventFilters } from "src/types/internal/EventFilters";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import { filterEvents } from "src/utils/filterEvents";

const NO_FILTERS: EventFilters = { route: null, query: "", type: null };

/** Route, search and type filters over the recorded events, with the visible subset derived once. */
export const useEventFilters = (events: Accessor<RecordedEvent[]>) => {
  const [current, setCurrent] = createSignal(NO_FILTERS);
  const visibleEvents = createMemo(() => filterEvents(events(), current()));

  const isFiltered = () => {
    const { route, query, type } = current();

    return route !== null || query.trim() !== "" || type !== null;
  };

  const update = (patch: Partial<EventFilters>) => {
    setCurrent((filters) => ({ ...filters, ...patch }));
  };

  const clear = () => {
    setCurrent(NO_FILTERS);
  };

  return { current, visibleEvents, isFiltered, update, clear };
};
