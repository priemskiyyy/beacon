import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";

/** A view of a Beacon that names other routes than its own, as one that changed under the inspector would. */
export const withRoutes = (
  beacon: ObservedBeacon,
  routeNames: string[],
): ObservedBeacon => ({ ...beacon, routeNames });
