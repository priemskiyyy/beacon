import { For, Match, Show, Switch } from "solid-js";

import { EventRow } from "src/components/Timeline/EventRow";
import { TimelineTypes } from "src/components/Timeline/TimelineTypes";
import type { EventFilterControls } from "src/types/internal/EventFilterControls";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";

type TimelineProps = {
  events: RecordedEvent[];
  filters: EventFilterControls;
  isPaused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
};

/** The diagnostic events: search, pause and clear, one chip per type, and the rows, newest first, or the reason there are none. */
export const Timeline = (props: TimelineProps) => (
  <div class="timeline">
    <div class="toolbar">
      <input
        aria-label="Filter events"
        type="search"
        placeholder="Filter by type, route, command, reason…"
        value={props.filters.current().query}
        onInput={(event) =>
          props.filters.update({ query: event.currentTarget.value })
        }
      />
      <button
        type="button"
        aria-pressed={props.isPaused}
        onClick={props.onTogglePause}
      >
        {props.isPaused ? "Resume" : "Pause"}
      </button>
      <button type="button" onClick={props.onClear}>
        Clear
      </button>
      <span class="total">
        {props.filters.visibleEvents().length} / {props.events.length}
      </span>
    </div>
    <TimelineTypes events={props.events} filters={props.filters} />
    <Show
      when={props.filters.visibleEvents().length > 0}
      fallback={
        <div class="empty">
          <Switch
            fallback={
              <>
                <strong>Waiting for events</strong>
                <p>
                  Sessions, reads, checks and commands appear here as your
                  application runs. Nothing is replayed from before the panel
                  mounted.
                </p>
              </>
            }
          >
            <Match when={props.filters.isFiltered()}>
              <strong>No matching events</strong>
              <p>Try another search, or show all routes and types.</p>
              <button type="button" onClick={props.filters.clear}>
                Clear filters
              </button>
            </Match>
            <Match when={props.isPaused}>
              <strong>Recording paused</strong>
              <p>
                Your application keeps running. Resume to capture new events.
              </p>
            </Match>
          </Switch>
        </div>
      }
    >
      <div class="events" role="list" aria-label="Event timeline">
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
  </div>
);
