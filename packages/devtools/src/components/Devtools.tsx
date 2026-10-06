import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import type { Accessor } from "solid-js";

import { Launcher } from "src/components/Launcher";
import { DevtoolsPanel } from "src/components/Panel/DevtoolsPanel";
import { useObservableValue } from "src/hooks/useObservableValue";
import { usePreferences } from "src/hooks/usePreferences";
import { styles } from "src/styles";
import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";
import type { PanelState } from "src/types/internal/PanelState";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { DEFAULT_SIZE } from "src/utils/constants/defaults";
import { OPPOSITE_POSITION, SIZE_KEY } from "src/utils/constants/dock";
import type { EventLog } from "src/utils/EventLog";

type DevtoolsProps = {
  beacon: Accessor<ObservedBeacon>;
  initialIsOpen: boolean;
  log: EventLog;
};

/** The shadow-root application: records while mounted and renders the launcher or the panel. */
export const Devtools = (props: DevtoolsProps) => {
  const { preferences, update } = usePreferences();
  const startsOpen = preferences().isOpen ?? props.initialIsOpen;

  // Focus only moves after the person opens or closes the panel, never on mount.
  const [panel, setPanel] = createSignal<PanelState>(
    startsOpen
      ? { status: "open", autoFocus: false }
      : { status: "closed", autoFocus: false, closedAfter: 0 },
  );

  const [isPaused, setIsPaused] = createSignal(false);
  // Never stored: a reveal of raw values must not outlive the page that asked for it.
  const [showRaw, setShowRaw] = createSignal(false);
  const status = useObservableValue(() => props.beacon().status);
  const position = () => preferences().position ?? "bottom";

  const size = () =>
    preferences()[SIZE_KEY[position()]] ?? DEFAULT_SIZE[position()];

  // Not read from the events, which a bounded history drops: a failure stays new until the panel is opened.
  const lastFailureId = useObservableValue(() => ({
    get: props.log.getLastFailureId,
    subscribe: props.log.subscribe,
  }));

  const hasUnseenFailure = createMemo(() => {
    const current = panel();

    return current.status === "closed" && lastFailureId() > current.closedAfter;
  });

  const closePanel = () => {
    setPanel({
      status: "closed",
      autoFocus: true,
      closedAfter: props.log.getLastId(),
    });
  };

  // Recording runs while mounted, also while collapsed, and stops while paused.
  createEffect(() => {
    if (isPaused()) {
      return;
    }

    onCleanup(props.beacon().diagnostics.events.subscribe(props.log.add));
  });

  // Written when the panel opens or closes, not on mount, so a page that never touches the devtools stores nothing.
  createEffect(
    on(
      () => panel().status === "open",
      (isOpen) => {
        update({ isOpen });
      },
      { defer: true },
    ),
  );

  return (
    <div>
      <style>{styles}</style>
      {(() => {
        const current = panel();

        if (current.status === "open") {
          return (
            <DevtoolsPanel
              beacon={props.beacon()}
              status={status()}
              log={props.log}
              isPaused={isPaused()}
              showRaw={showRaw()}
              autoFocus={current.autoFocus}
              position={position()}
              size={size()}
              onSizeChange={(next) => update({ [SIZE_KEY[position()]]: next })}
              onDock={() => update({ position: OPPOSITE_POSITION[position()] })}
              onTogglePause={() => setIsPaused((paused) => !paused)}
              onShowRawChange={setShowRaw}
              onClose={closePanel}
            />
          );
        }

        if (current.status === "closed") {
          return (
            <Launcher
              status={status().state}
              hasUnseenFailure={hasUnseenFailure()}
              autoFocus={current.autoFocus}
              onOpen={() => setPanel({ status: "open", autoFocus: true })}
            />
          );
        }

        return assertUnreachable(current);
      })()}
    </div>
  );
};
