import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";
import type { ObservedRoute } from "src/types/internal/ObservedRoute";

/** The handle of a route by name, or `null` when the Beacon has none by that name, as one swapped in after the selection was made may not. */
export const findRoute = (
  beacon: ObservedBeacon,
  name: string,
): ObservedRoute | null => {
  try {
    return beacon.route(name);
  } catch {
    return null;
  }
};
