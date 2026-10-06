import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningSubject } from "src/types/RunningSubject";

/** The running subjects a route's check depends on: its own for a feed route, none for a provider that answers by itself. */
export const getSubjects = (definition: RouteDefinition): RunningSubject[] => {
  if (definition.kind === "feed") {
    return [definition.subject];
  }

  return [];
};
