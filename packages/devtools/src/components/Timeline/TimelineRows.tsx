import { For, Show } from "solid-js";

import { EventRow } from "src/components/Timeline/EventRow";
import { TimelineEmpty } from "src/components/Timeline/TimelineEmpty";
import type { EventFilterControls } from "src/types/internal/EventFilterControls";

type TimelineRowsProps = {
  filters: EventFilterControls;
  isPaused: boolean;
};

/** The visible events, newest first, or the reason there are none. */
export const TimelineRows = (props: TimelineRowsProps) => (
  <Show
    when={props.filters.visibleEvents().length > 0}
    fallback={
      <div class="empty">
        <TimelineEmpty
          isFiltered={props.filters.isFiltered()}
          isPaused={props.isPaused}
          onClearFilters={() => props.filters.clear()}
        />
      </div>
    }
  >
    <div class="events" aria-label="Event timeline">
      <div class="event-head" aria-hidden="true">
        <span>Time</span>
        <span>Type</span>
        <span>Session</span>
        <span>Route</span>
        <span>Command</span>
        <span>Attempt</span>
        <span>Op</span>
        <span>Reason</span>
        <span />
      </div>
      <For each={props.filters.visibleEvents()}>
        {(event) => <EventRow event={event} />}
      </For>
    </div>
  </Show>
);
