import type { CommandMap } from "src/types/CommandMap";
import type { DriverRoute } from "src/types/DriverRoute";
import type { RouteBody } from "src/types/RouteBody";

/**
 * A driver under test, over a fake provider SDK created for this test alone:
 * the route, and the fake's way of reporting a change and counting the
 * listeners the driver holds on it.
 *
 * @example
 * ```ts
 * const fake = fakeBridge();
 * const fixture: ReleaseDriverFixture<PlayNative, PlayOffer, PlayBody, typeof commands> = {
 *   route: googlePlay({ bridge: fake.bridge }),
 *   provider: { update: fake.install, listeners: fake.listeners },
 * };
 * ```
 */
export type ReleaseDriverFixture<
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
> = {
  route: DriverRoute<TNative, TOffer, TPrepared, TCommands>;
  /** The provider's change events. Leave it out when the provider reports no changes. */
  provider?: {
    /** Makes the provider report a change, as its SDK would. */
    update: () => void;
    /** How many change listeners the driver holds on the provider. */
    listeners: () => number;
  };
};
