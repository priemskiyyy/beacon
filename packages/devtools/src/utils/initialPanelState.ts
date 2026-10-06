import type { PanelState } from "src/types/internal/PanelState";

/** Focus only moves after the user opens or closes the panel, never on mount. */
export const initialPanelState = (isOpen: boolean): PanelState => {
  if (isOpen) {
    return { status: "OPEN", autoFocus: false };
  }

  return { status: "CLOSED", autoFocus: false, closedAfter: 0 };
};
