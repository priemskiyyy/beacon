import type { OfferReference } from "src/types/OfferReference";
import type { PreparedReference } from "src/types/PreparedReference";

/**
 * The arguments a route method takes, derived from what its command declares:
 * an offer reference, a prepared reference, an optional offer, or nothing,
 * plus its parameters. A reference of another route or another kind does not
 * compile.
 *
 * @example
 * ```ts
 * type Reload = CommandArguments<"web", "offer", Record<never, never>>;
 * ```
 */
export type CommandArguments<
  TRoute extends string,
  TRequirement,
  TParameters extends object,
> = TRequirement extends "offer"
  ? [input: { offer: OfferReference<TRoute> } & TParameters]
  : TRequirement extends "prepared"
    ? [input: { prepared: PreparedReference<TRoute> } & TParameters]
    : TRequirement extends "optional-offer"
      ? [input?: { offer?: OfferReference<TRoute> } & TParameters]
      : Record<never, never> extends TParameters
        ? [input?: TParameters]
        : [input: TParameters];
