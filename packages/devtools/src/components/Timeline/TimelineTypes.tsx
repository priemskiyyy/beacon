import { For, createMemo } from "solid-js";

import type { EventFilterControls } from "src/types/internal/EventFilterControls";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import { isFailureEvent } from "src/utils/isFailureEvent";

type TimelineTypesProps = {
  events: RecordedEvent[];
  filters: EventFilterControls;
};

/** A chip for each event type recorded, with its count; one type at a time narrows the rows. */
export const TimelineTypes = (props: TimelineTypesProps) => {
  const counts = createMemo(() => {
    const counted = new Map<string, number>();

    for (const event of props.events) {
      counted.set(event.type, (counted.get(event.type) ?? 0) + 1);
    }

    return counted;
  });

  const selected = () => props.filters.current().type;

  // The selected type keeps its chip after a clear, so the filter that hides everything stays visible.
  const types = createMemo(() => {
    const current = selected();
    const shown = [...counts().keys()];

    if (current !== null && !shown.includes(current)) {
      shown.push(current);
    }

    return shown.sort();
  });

  return (
    <div class="chips" role="group" aria-label="Event types">
      <button
        type="button"
        class="chip"
        aria-pressed={selected() === null}
        onClick={() => props.filters.update({ type: null })}
      >
        All <span class="count">{props.events.length}</span>
      </button>
      <For each={types()}>
        {(type) => (
          <button
            type="button"
            class="chip"
            data-failure={isFailureEvent(type)}
            aria-pressed={selected() === type}
            onClick={() => props.filters.update({ type })}
          >
            {type} <span class="count">{counts().get(type) ?? 0}</span>
          </button>
        )}
      </For>
    </div>
  );
};
