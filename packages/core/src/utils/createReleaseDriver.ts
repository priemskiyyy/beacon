import type { CommandMap } from "src/types/CommandMap";
import type { DriverRoute } from "src/types/DriverRoute";
import type { ReleaseDriver } from "src/types/ReleaseDriver";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Declares a provider-owned route from its driver. Name the native, offer and
 * prepared types once and each command's `run` receives them, typed, along
 * with the reference it declared. The route goes into `routes` as it is.
 *
 * @example
 * ```ts
 * const ota = createReleaseDriver<Updates, UpdateBody, UpdateBody, typeof commands>({
 *   name: "expo-updates",
 *   subject: "bundle",
 *   prepares: true,
 *   open: () => ({ native: updates, check }),
 *   commands,
 * });
 * ```
 */
export const createReleaseDriver = <
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
>(
  driver: ReleaseDriver<TNative, TOffer, TPrepared, TCommands>,
): DriverRoute<TNative, TOffer, TPrepared, TCommands> => ({
  kind: "driver",
  driver,
});
