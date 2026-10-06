import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import type { RouteDefinition } from "src/types/RouteDefinition";

/** The commands of a route, wherever its kind keeps them. */
export const getCommands = (
  definition: RouteDefinition,
): CommandMap<object, RouteBody, RouteBody> => {
  if (definition.kind === "feed") {
    return definition.mechanism.commands;
  }

  return definition.driver.commands;
};
