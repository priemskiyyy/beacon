import { For, Show } from "solid-js";

import { RouteRow } from "src/components/Routes/RouteRow";
import type { RouteView } from "src/types/internal/RouteView";

type RouteListProps = {
  views: RouteView[];
  selected: string | null;
  onSelect: (name: string | null) => void;
};

/** The overview and one row per route, in the order the Beacon defined them. */
export const RouteList = (props: RouteListProps) => (
  <nav class="rows" aria-label="Beacon routes">
    <button
      type="button"
      class="row"
      aria-pressed={props.selected === null}
      onClick={() => props.onSelect(null)}
    >
      <span class="row-name">
        <span class="row-title">Overview</span>
      </span>
      <small>running, support and transitions</small>
    </button>
    <For each={props.views}>
      {(view) => (
        <RouteRow
          view={view}
          isSelected={props.selected === view.name}
          onSelect={() => props.onSelect(view.name)}
        />
      )}
    </For>
    <Show when={props.views.length === 0}>
      <p class="row-empty">no routes defined</p>
    </Show>
  </nav>
);
