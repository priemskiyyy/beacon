import type { CommandParameters } from "src/types/CommandParameters";
import type { Offer } from "src/types/Offer";
import type { OfferReference } from "src/types/OfferReference";
import type { Prepared } from "src/types/Prepared";
import type { PreparedReference } from "src/types/PreparedReference";
import type { RouteBody } from "src/types/RouteBody";

type GivenOffer<TRoute extends string> =
  Offer<TRoute, RouteBody> | OfferReference<TRoute>;

type GivenPrepared<TRoute extends string> =
  Prepared<TRoute, RouteBody> | PreparedReference<TRoute>;

type CommandControl = {
  /** Ends this caller's wait; after a dispatch the command is then `indeterminate`, never cancelled. */
  signal?: AbortSignal;
};

/**
 * The arguments a route method takes, derived from what its command declares:
 * an offer, a prepared target, an optional offer, or nothing, plus its
 * parameters and an optional `signal`. Each is the object the route's state
 * holds, or its `ref`, which is what Beacon reads: a copy of a reference is
 * refused either way. An offer or a reference of another route or another kind
 * does not compile.
 *
 * @example
 * ```ts
 * type Reload = CommandArguments<"web", "offer", Record<never, never>>;
 *
 * const reload = (input: Reload[0]) => beacon.route("web").reload(input);
 *
 * if (observation.status === "available") {
 *   reload({ offer: observation.offer });
 * }
 * ```
 */
export type CommandArguments<
  TRoute extends string,
  TReference,
  TParameters extends CommandParameters,
> = TReference extends "offer"
  ? [input: { offer: GivenOffer<TRoute> } & CommandControl & TParameters]
  : TReference extends "prepared"
    ? [
        input: { prepared: GivenPrepared<TRoute> } & CommandControl &
          TParameters,
      ]
    : TReference extends "optional-offer"
      ? [input?: { offer?: GivenOffer<TRoute> } & CommandControl & TParameters]
      : Record<never, never> extends TParameters
        ? [input?: CommandControl & TParameters]
        : [input: CommandControl & TParameters];
