import type { CommandMap } from "src/types/CommandMap";
import type { ReleaseDriver } from "src/types/ReleaseDriver";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Declares a provider-owned route. Name the native, offer and prepared types
 * once and each command's `run` receives them, typed, along with the
 * reference it declared.
 *
 * @example
 * ```ts
 * const driver = createReleaseDriver<Updates, UpdateBody, UpdateBody, typeof commands>({
 *   name: "expo-updates",
 *   prepares: true,
 *   open: () => ({ native: updates, check }),
 *   commands,
 * });
 * ```
 */
export const createReleaseDriver = <
  TNative,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
>(
  driver: ReleaseDriver<TNative, TOffer, TPrepared, TCommands>,
): ReleaseDriver<TNative, TOffer, TPrepared, TCommands> => driver;
