import type { RouteDefinition } from "src/types/RouteDefinition";

/** A route that takes its offers from a release source. */
export type FeedDefinition = Extract<RouteDefinition, { kind: "feed" }>;
