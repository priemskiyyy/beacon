import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import type { RouteDefinition } from "src/types/RouteDefinition";

type Commands = CommandMap<unknown, RouteBody, RouteBody>;

const getCommands = (definition: RouteDefinition): Commands => {
  if (definition.kind === "feed") {
    return definition.mechanism.commands;
  }

  return definition.driver.commands;
};

/** What each command of a route declares, frozen, so a presentation can warn before it acts. */
export const readCapabilities = (definition: RouteDefinition) =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(getCommands(definition)).map(([name, command]) => [
        name,
        Object.freeze({
          reference: command.reference,
          impacts: Object.freeze([...command.impacts]),
          binding: command.binding,
        }),
      ]),
    ),
  );
