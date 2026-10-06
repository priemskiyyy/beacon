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
import { useStoredValue } from "src/hooks/useStoredValue";
import { styles } from "src/styles";
import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";
import type { PanelState } from "src/types/internal/PanelState";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { DEFAULT_SIZE, PREFERENCES_KEY } from "src/utils/constants/defaults";
import type { EventLog } from "src/utils/EventLog";
import { initialPanelState } from "src/utils/initialPanelState";
import { parsePreferences } from "src/utils/parsePreferences";

type DevtoolsProps = {
  beacon: Accessor<ObservedBeacon>;
  maxEvents: Accessor<number>;
  initialIsOpen: boolean;
  log: EventLog;
};

/** The shadow-root application: records while mounted and renders the launcher or the panel. */
export const Devtools = (props: DevtoolsProps) => {
  const [preferences, setPreferences] = useStoredValue(
    PREFERENCES_KEY,
    parsePreferences,
    {},
  );

  const [panel, setPanel] = createSignal<PanelState>(
    initialPanelState(preferences().isOpen ?? props.initialIsOpen),
  );

  const [isPaused, setIsPaused] = createSignal(false);
  // Never stored: a reveal of raw values must not outlive the page that asked for it.
  const [showRaw, setShowRaw] = createSignal(false);
  const status = useObservableValue(() => props.beacon().status);
  const events = useObservableValue(() => props.log);
  const position = createMemo(() => preferences().position ?? "bottom");

  const size = createMemo(() => {
    const { height, width } = preferences();
    const current = position();

    if (current === "bottom") {
      return height ?? DEFAULT_SIZE.bottom;
    }

    if (current === "right") {
      return width ?? DEFAULT_SIZE.right;
    }

    return assertUnreachable(current);
  });

  const hasUnseenFailure = createMemo(() => {
    const current = panel();

    if (current.status !== "CLOSED") {
      return false;
    }

    return events().some(
      (event) => event.failure && event.id > current.closedAfter,
    );
  });

  const handleSizeChange = (next: number) => {
    const current = position();

    if (current === "bottom") {
      setPreferences({ ...preferences(), height: next });

      return;
    }

    if (current === "right") {
      setPreferences({ ...preferences(), width: next });

      return;
    }

    assertUnreachable(current);
  };

  const handleDock = () => {
    const current = position();

    if (current === "bottom") {
      setPreferences({ ...preferences(), position: "right" });

      return;
    }

    if (current === "right") {
      setPreferences({ ...preferences(), position: "bottom" });

      return;
    }

    assertUnreachable(current);
  };

  const handleClose = () => {
    setPanel({
      status: "CLOSED",
      autoFocus: true,
      closedAfter: props.log.getLastId(),
    });
  };

  createEffect(() => {
    props.log.setLimit(props.maxEvents());
  });

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
      () => panel().status === "OPEN",
      (isOpen) => {
        setPreferences({ ...preferences(), isOpen });
      },
      { defer: true },
    ),
  );

  return (
    <div class="root" data-beacon-devtools="">
      <style>{styles}</style>
      {(() => {
        const current = panel();

        if (current.status === "OPEN") {
          return (
            <DevtoolsPanel
              beacon={props.beacon()}
              status={status()}
              events={events()}
              isPaused={isPaused()}
              showRaw={showRaw()}
              autoFocus={current.autoFocus}
              position={position()}
              size={size()}
              onSizeChange={handleSizeChange}
              onDock={handleDock}
              onTogglePause={() => setIsPaused((paused) => !paused)}
              onShowRawChange={setShowRaw}
              onClear={props.log.clear}
              onClose={handleClose}
            />
          );
        }

        if (current.status === "CLOSED") {
          return (
            <Launcher
              status={status().state}
              hasUnseenFailure={hasUnseenFailure()}
              autoFocus={current.autoFocus}
              onOpen={() => setPanel({ status: "OPEN", autoFocus: true })}
            />
          );
        }

        return assertUnreachable(current);
      })()}
    </div>
  );
};
