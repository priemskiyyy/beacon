import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import type { UpdateMechanism } from "src/types/UpdateMechanism";

/**
 * A mechanism under test, over a fake platform created for this test alone:
 * the mechanism, how many times it opened the platform, and what it holds on
 * the platform right now.
 *
 * @example
 * ```ts
 * const fixture: UpdateMechanismFixture<Browser, typeof commands> = {
 *   mechanism: browserReload({ target: fakeWindow() }),
 *   opens: () => opened,
 * };
 * ```
 */
export type UpdateMechanismFixture<
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  mechanism: UpdateMechanism<TNative, TCommands>;
  /** How many times the mechanism has opened its platform. */
  opens: () => number;
  /** What the mechanism holds on the platform right now, such as listeners; leave it out when it holds nothing. */
  held?: () => number;
};
