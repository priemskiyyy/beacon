import type { BeaconStatus } from "@priemskiyyy/beacon";
import { Show, createMemo, createSignal } from "solid-js";

import { Overview } from "src/components/Overview/Overview";
import { PanelHeader } from "src/components/Panel/PanelHeader";
import { ResizeHandle } from "src/components/Panel/ResizeHandle";
import { RouteDetail } from "src/components/Routes/RouteDetail";
import { RouteList } from "src/components/Routes/RouteList";
import { Timeline } from "src/components/Timeline/Timeline";
import { useAutoFocus } from "src/hooks/useAutoFocus";
import { useEventFilters } from "src/hooks/useEventFilters";
import { useObservableValue } from "src/hooks/useObservableValue";
import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";
import type { PanelPosition } from "src/types/internal/PanelPosition";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import type { RouteView } from "src/types/internal/RouteView";
import { findRoute } from "src/utils/findRoute";

type DevtoolsPanelProps = {
  beacon: ObservedBeacon;
  status: BeaconStatus;
  events: RecordedEvent[];
  isPaused: boolean;
  showRaw: boolean;
  /** False when the panel opened from stored preferences, so mounting never steals focus. */
  autoFocus: boolean;
  position: PanelPosition;
  /** Height when docked to the bottom, width when docked to the right. */
  size: number;
  onSizeChange: (size: number) => void;
  onDock: () => void;
  onTogglePause: () => void;
  onShowRawChange: (enabled: boolean) => void;
  onClear: () => void;
  onClose: () => void;
};

/** The open panel. Everything it subscribes to lives only while it is open. */
export const DevtoolsPanel = (props: DevtoolsPanelProps) => {
  const focusOnMount = useAutoFocus(props.autoFocus);
  const filters = useEventFilters(() => props.events);
  const [isChecking, setIsChecking] = createSignal(false);
  const diagnostics = useObservableValue(() => props.beacon.diagnostics);
  const running = useObservableValue(() => props.beacon.running);
  const support = useObservableValue(() => props.beacon.support);
  const transitions = useObservableValue(() => props.beacon.transitions);

  const views = createMemo(() =>
    props.beacon.routeNames.flatMap((name): RouteView[] => {
      const route = findRoute(props.beacon, name);

      if (route === null) {
        return [];
      }

      return [{ name, route }];
    }),
  );

  // The selection names a route; the Beacon says whether it still exists.
  const selected = createMemo(() => {
    const name = filters.filters().route;

    return views().find((view) => view.name === name) ?? null;
  });

  const handleCheck = () => {
    if (isChecking()) {
      return;
    }

    setIsChecking(true);

    const finish = () => setIsChecking(false);

    // The only action: one check, which never rejects and never starts a session.
    props.beacon.check({ reason: "manual" }).then(finish, finish);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }

    event.stopPropagation();
    props.onClose();
  };

  return (
    <aside
      ref={focusOnMount}
      tabIndex={-1}
      class="panel"
      data-position={props.position}
      aria-label="Beacon devtools"
      style={
        props.position === "bottom"
          ? { height: `${props.size}px` }
          : { width: `${props.size}px` }
      }
      onKeyDown={handleKeyDown}
    >
      <ResizeHandle
        position={props.position}
        size={props.size}
        onSizeChange={(size) => props.onSizeChange(size)}
      />
      <PanelHeader
        status={props.status}
        counters={diagnostics().counters}
        isChecking={isChecking()}
        showRaw={props.showRaw}
        position={props.position}
        onCheck={handleCheck}
        onShowRawChange={(enabled) => props.onShowRawChange(enabled)}
        onDock={() => props.onDock()}
        onClose={() => props.onClose()}
      />
      <div class="body">
        <RouteList
          views={views()}
          selected={filters.filters().route}
          onSelect={(route) => filters.update({ route })}
        />
        <div class="main">
          <Show
            when={selected()}
            fallback={
              <Overview
                running={running()}
                support={support()}
                transitions={transitions()}
                showRaw={props.showRaw}
              />
            }
          >
            {(view) => (
              <RouteDetail
                view={view()}
                showRaw={props.showRaw}
                onClose={() => filters.update({ route: null })}
              />
            )}
          </Show>
          <Timeline
            events={props.events}
            filters={filters}
            isPaused={props.isPaused}
            onTogglePause={() => props.onTogglePause()}
            onClear={() => props.onClear()}
          />
        </div>
      </div>
    </aside>
  );
};
