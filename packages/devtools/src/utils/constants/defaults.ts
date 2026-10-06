import type { PanelPosition } from "src/types/internal/PanelPosition";

/** The events the inspector keeps in memory unless `maxEvents` says otherwise. */
export const DEFAULT_MAX_EVENTS = 200;

/** `maxEvents` is clamped to this range, never thrown on: a bad prop must not crash the host application. */
export const EVENT_LIMIT = { min: 1, max: 1_000 };

/** Where the panel keeps its open state, dock position and size. */
export const PREFERENCES_KEY = "@priemskiyyy/beacon-devtools";

/** The panel's first height when docked to the bottom and its first width when docked to the right. */
export const DEFAULT_SIZE = { bottom: 420, right: 520 } satisfies Record<
  PanelPosition,
  number
>;

/** Milliseconds "Copied" stays on a copy button. */
export const COPY_FEEDBACK = 1_200;
