import type { PanelPosition } from "src/types/internal/PanelPosition";
import type { Preferences } from "src/types/internal/Preferences";

/** The preference that holds a docked panel's size: its height along the bottom edge, its width along the right one. */
export const SIZE_KEY = { bottom: "height", right: "width" } satisfies Record<
  PanelPosition,
  keyof Preferences
>;

/** The edge the dock button moves the panel to. */
export const OPPOSITE_POSITION = {
  bottom: "right",
  right: "bottom",
} satisfies Record<PanelPosition, PanelPosition>;
