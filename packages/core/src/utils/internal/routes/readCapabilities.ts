import type { RouteDefinition } from "src/types/RouteDefinition";
import { getCommands } from "src/utils/internal/routes/getCommands";

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
