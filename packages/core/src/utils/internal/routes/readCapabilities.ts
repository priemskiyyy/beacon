import type { RouteEntry } from "src/types/internal/RouteEntry";

/** What each command of a route declares, frozen, so a presentation can warn before it acts. */
export const readCapabilities = (commands: RouteEntry["commands"]) =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(commands).map(([name, command]) => [
        name,
        Object.freeze({
          reference: command.reference,
          impacts: Object.freeze([...command.impacts]),
          binding: command.binding,
        }),
      ]),
    ),
  );
