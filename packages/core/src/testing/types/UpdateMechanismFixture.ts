import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import type { UpdateMechanism } from "src/types/UpdateMechanism";

/**
 * A mechanism under test, over a fake platform created for this test alone,
 * and what it holds on that platform right now when the fake can say.
 *
 * @example
 * ```ts
 * const platform = fakePlatform();
 * const fixture: UpdateMechanismFixture<Browser, typeof commands> = {
 *   mechanism: browserReload({ target: platform.window }),
 *   held: platform.listeners,
 * };
 * ```
 */
export type UpdateMechanismFixture<
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  mechanism: UpdateMechanism<TNative, TCommands>;
  /** What the mechanism holds on the platform right now, such as listeners: nothing before a session opens and as much as before once it ends. Leave it out when the fake cannot say. */
  held?: () => number;
};
