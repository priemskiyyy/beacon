import { BeaconError } from "src/utils/BeaconError";

const listRoutes = (names: string[]) => {
  const quoted = names.map((name) => `"${name}"`);
  const last = quoted.pop();

  if (last === undefined) {
    return "The Beacon has no routes.";
  }

  if (quoted.length === 0) {
    return `The only route is ${last}.`;
  }

  return `The routes are ${quoted.join(", ")} and ${last}.`;
};

// A name that arrives from untyped code, most often a typo, so the message lists what there is to choose from.
export const createUnknownRouteError = (name: string, known: string[]) =>
  new BeaconError({
    code: "INVALID_CONFIGURATION",
    message: `The route "${name}" is not defined. ${listRoutes(known)}`,
  });
