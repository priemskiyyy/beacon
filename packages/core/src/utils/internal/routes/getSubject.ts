import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningSubject } from "src/types/RunningSubject";

/** The running subject a route replaces: its own for a feed route, the provider's for a driver route. */
export const getSubject = (definition: RouteDefinition): RunningSubject => {
  if (definition.kind === "feed") {
    return definition.subject;
  }

  return definition.driver.subject;
};
