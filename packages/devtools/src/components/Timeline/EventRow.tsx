import { createSignal, Show } from "solid-js";

import { CopyButton } from "src/components/shared/CopyButton";
import { formatCell } from "src/formatting/formatCell";
import { formatEventText } from "src/formatting/formatEventText";
import { formatEventTime } from "src/formatting/formatEventTime";
import { formatIsoTime } from "src/formatting/formatIsoTime";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";

type EventRowProps = { event: RecordedEvent };

/** One event: a row of its fields that expands into the whole record, with a copy button. */
export const EventRow = (props: EventRowProps) => {
  // The record is built only while the row is open, so a long history costs a row of text each.
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <div class="event" role="listitem" data-failure={props.event.failure}>
      <button
        type="button"
        class="event-summary"
        aria-expanded={isOpen()}
        onClick={() => setIsOpen((open) => !open)}
      >
        <time
          dateTime={formatIsoTime(props.event.timestamp)}
          title={formatIsoTime(props.event.timestamp)}
        >
          {formatEventTime(props.event.timestamp)}
        </time>
        <span class="event-type">{props.event.type}</span>
        <span>{formatCell(props.event.session)}</span>
        <span title={props.event.route ?? undefined}>
          {formatCell(props.event.route)}
        </span>
        <span title={props.event.command ?? undefined}>
          {formatCell(props.event.command)}
        </span>
        <span>{formatCell(props.event.attempt)}</span>
        <span>{formatCell(props.event.operation)}</span>
        <span class="event-reason" title={props.event.reason ?? undefined}>
          {formatCell(props.event.reason)}
        </span>
        <svg
          class="expand"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
        >
          <path
            d="M2 3.5 5 6.5 8 3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </button>
      <Show when={isOpen()}>
        <div class="context">
          <pre>{formatEventText(props.event)}</pre>
          <CopyButton text={formatEventText(props.event)} />
        </div>
      </Show>
    </div>
  );
};
