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
import type { RouteView } from "src/types/internal/RouteView";
import type { EventLog } from "src/utils/EventLog";

type DevtoolsPanelProps = {
  beacon: ObservedBeacon;
  status: BeaconStatus;
  log: EventLog;
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
  onClose: () => void;
};

/** The open panel. Everything it subscribes to lives only while it is open. */
export const DevtoolsPanel = (props: DevtoolsPanelProps) => {
  const focusOnMount = useAutoFocus(props.autoFocus);
  const events = useObservableValue(() => props.log);
  const filters = useEventFilters(events);
  const [isChecking, setIsChecking] = createSignal(false);
  const diagnostics = useObservableValue(() => props.beacon.diagnostics);

  const views = createMemo(() =>
    props.beacon.routeNames.map((name): RouteView => ({
      name,
      route: props.beacon.route(name),
    })),
  );

  // The selection names a route; the Beacon says whether it still exists.
  const selected = () => {
    const name = filters.current().route;

    return views().find((view) => view.name === name) ?? null;
  };

  // The button is disabled while a check runs, but a click that is dispatched to it anyway must not start another.
  const checkNow = () => {
    if (isChecking()) {
      return;
    }

    setIsChecking(true);

    const finish = () => setIsChecking(false);

    // The only action: one check, which never rejects and never starts a session.
    props.beacon.check({ reason: "manual" }).then(finish, finish);
  };

  const closeOnEscape = (event: KeyboardEvent) => {
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
      onKeyDown={closeOnEscape}
    >
      <ResizeHandle
        position={props.position}
        size={props.size}
        onSizeChange={props.onSizeChange}
      />
      <PanelHeader
        status={props.status}
        counters={diagnostics().counters}
        isChecking={isChecking()}
        showRaw={props.showRaw}
        position={props.position}
        onCheck={checkNow}
        onShowRawChange={props.onShowRawChange}
        onDock={props.onDock}
        onClose={props.onClose}
      />
      <div class="body">
        <RouteList
          views={views()}
          selected={filters.current().route}
          onSelect={(route) => filters.update({ route })}
        />
        <div class="main">
          <Show
            when={selected()}
            fallback={
              <Overview beacon={props.beacon} showRaw={props.showRaw} />
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
            events={events()}
            filters={filters}
            isPaused={props.isPaused}
            onTogglePause={props.onTogglePause}
            onClear={props.log.clear}
          />
        </div>
      </div>
    </aside>
  );
};
