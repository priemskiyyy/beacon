import type { UpdateMechanismFixture } from "src/testing/types/UpdateMechanismFixture";
import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";

/**
 * What a mechanism's conformance suite is run over: a name for the report, and
 * a `create` that makes a fresh fixture for every test.
 *
 * @example
 * ```ts
 * const options: UpdateMechanismConformanceOptions<Browser, typeof commands> = {
 *   name: "browser-reload",
 *   create: () => ({ mechanism: browserReload({ target: fakeWindow() }) }),
 * };
 * ```
 */
export type UpdateMechanismConformanceOptions<
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  name: string;
  create: () => UpdateMechanismFixture<TNative, TCommands>;
};
