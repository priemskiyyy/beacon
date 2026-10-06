import type { CommandMap } from "src/types/CommandMap";
import type { ReleaseDriver } from "src/types/ReleaseDriver";
import type { RouteBody } from "src/types/RouteBody";

/**
 * A route a provider driver owns. Adapters such as Expo Updates and Google
 * Play return one, so an application passes it to `routes` as it is.
 *
 * @example
 * ```ts
 * const routes = { ota: expoUpdates({ sdk: Updates }) };
 * ```
 */
export type DriverRoute<
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
> = {
  kind: "driver";
  driver: ReleaseDriver<TNative, TOffer, TPrepared, TCommands>;
};
