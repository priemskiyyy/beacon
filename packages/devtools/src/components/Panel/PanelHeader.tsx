import type {
  BeaconDiagnosticCounters,
  BeaconStatus,
} from "@priemskiyyy/beacon";

import { BeaconIcon } from "src/components/BeaconIcon";
import { StateBadge } from "src/components/shared/StateBadge";
import { formatStatus } from "src/formatting/formatStatus";
import type { PanelPosition } from "src/types/internal/PanelPosition";

type PanelHeaderProps = {
  status: BeaconStatus;
  counters: BeaconDiagnosticCounters;
  isChecking: boolean;
  showRaw: boolean;
  position: PanelPosition;
  onCheck: () => void;
  onShowRawChange: (enabled: boolean) => void;
  onDock: () => void;
  onClose: () => void;
};

/** Where the session stands, what Beacon contained, the one action, and the panel's own controls. */
export const PanelHeader = (props: PanelHeaderProps) => (
  <header class="header">
    <BeaconIcon />
    <strong>Beacon</strong>
    <StateBadge state={props.status.state}>
      {formatStatus(props.status)}
    </StateBadge>
    <div class="counters" role="group" aria-label="Diagnostic counters">
      <span
        title="Answers that arrived after their session ended"
        data-alert={props.counters.lateCallbacks > 0}
      >
        late callbacks {props.counters.lateCallbacks}
      </span>
      <span
        title="Listeners that threw"
        data-alert={props.counters.listenerErrors > 0}
      >
        listener errors {props.counters.listenerErrors}
      </span>
      <span
        title="Cleanups that threw"
        data-alert={props.counters.cleanupErrors > 0}
      >
        cleanup errors {props.counters.cleanupErrors}
      </span>
    </div>
    <button
      type="button"
      class="check"
      title="Asks every route's authority once. It needs a running session and never starts one."
      disabled={props.status.state !== "running" || props.isChecking}
      onClick={() => props.onCheck()}
    >
      Check now
    </button>
    <label class="capture">
      <input
        type="checkbox"
        checked={props.showRaw}
        onChange={(event) => props.onShowRawChange(event.currentTarget.checked)}
      />
      Show raw values
    </label>
    <button
      type="button"
      class="icon-button"
      aria-label={
        props.position === "bottom" ? "Dock to the right" : "Dock to the bottom"
      }
      onClick={() => props.onDock()}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <rect
          x="1.5"
          y="1.5"
          width="11"
          height="11"
          rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
        />
        {props.position === "bottom" ? (
          <rect
            x="8"
            y="1.5"
            width="4.5"
            height="11"
            rx="1"
            fill="currentColor"
          />
        ) : (
          <rect
            x="1.5"
            y="8"
            width="11"
            height="4.5"
            rx="1"
            fill="currentColor"
          />
        )}
      </svg>
    </button>
    <button
      type="button"
      class="icon-button"
      aria-label="Close devtools"
      onClick={() => props.onClose()}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path
          d="M3 3l8 8M11 3l-8 8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </header>
);
