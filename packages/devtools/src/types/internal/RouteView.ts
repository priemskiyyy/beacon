import type { ObservedRoute } from "src/types/internal/ObservedRoute";

/** A route of the inspected Beacon by its name, as the sidebar and the detail read it. */
export type RouteView = { name: string; route: ObservedRoute };
