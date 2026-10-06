import type { ReleaseDriverFixture } from "src/testing/types/ReleaseDriverFixture";
import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";

/**
 * What a driver's conformance suite is run over: a name for the report, and a
 * `create` that makes a fresh fixture for every test.
 *
 * @example
 * ```ts
 * const options: ReleaseDriverConformanceOptions<UpdatesNative, UpdateBody, UpdateBody, typeof commands> = {
 *   name: "expo-updates",
 *   create: () => ({ route: expoUpdates({ updates: fakeUpdates().updates }) }),
 * };
 * ```
 */
export type ReleaseDriverConformanceOptions<
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
> = {
  name: string;
  create: () => ReleaseDriverFixture<TNative, TOffer, TPrepared, TCommands>;
};
