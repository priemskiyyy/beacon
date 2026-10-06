import { TimelineRows } from "src/components/Timeline/TimelineRows";
import { TimelineToolbar } from "src/components/Timeline/TimelineToolbar";
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

/** The diagnostic events: a toolbar, one chip per type, and the rows. */
export const Timeline = (props: TimelineProps) => (
  <div class="timeline">
    <TimelineToolbar
      filters={props.filters}
      total={props.events.length}
      isPaused={props.isPaused}
      onTogglePause={() => props.onTogglePause()}
      onClear={() => props.onClear()}
    />
    <TimelineTypes events={props.events} filters={props.filters} />
    <TimelineRows filters={props.filters} isPaused={props.isPaused} />
  </div>
);
