import type { EventFilterControls } from "src/types/internal/EventFilterControls";

type TimelineToolbarProps = {
  filters: EventFilterControls;
  total: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
};

/** Search, pause and clear. */
export const TimelineToolbar = (props: TimelineToolbarProps) => (
  <div class="toolbar">
    <input
      aria-label="Filter events"
      type="search"
      placeholder="Filter by type, route, command, reason…"
      value={props.filters.filters().query}
      onInput={(event) =>
        props.filters.update({ query: event.currentTarget.value })
      }
    />
    <button
      type="button"
      aria-pressed={props.isPaused}
      onClick={() => props.onTogglePause()}
    >
      {props.isPaused ? "Resume" : "Pause"}
    </button>
    <button type="button" onClick={() => props.onClear()}>
      Clear
    </button>
    <span class="total">
      {props.filters.visibleEvents().length} / {props.total}
    </span>
  </div>
);
