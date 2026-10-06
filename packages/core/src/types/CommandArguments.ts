import type { CommandParameters } from "src/types/CommandParameters";
import type { OfferReference } from "src/types/OfferReference";
import type { PreparedReference } from "src/types/PreparedReference";

type CommandControl = {
  /** Ends this caller's wait; after a dispatch the command is then `indeterminate`, never cancelled. */
  signal?: AbortSignal;
};

/**
 * The arguments a route method takes, derived from what its command declares:
 * an offer reference, a prepared reference, an optional offer, or nothing,
 * plus its parameters and an optional `signal`. A reference of another route
 * or another kind does not compile.
 *
 * @example
 * ```ts
 * type Reload = CommandArguments<"web", "offer", Record<never, never>>;
 * ```
 */
export type CommandArguments<
  TRoute extends string,
  TReference,
  TParameters extends CommandParameters,
> = TReference extends "offer"
  ? [input: { offer: OfferReference<TRoute> } & CommandControl & TParameters]
  : TReference extends "prepared"
    ? [
        input: { prepared: PreparedReference<TRoute> } & CommandControl &
          TParameters,
      ]
    : TReference extends "optional-offer"
      ? [
          input?: { offer?: OfferReference<TRoute> } & CommandControl &
            TParameters,
        ]
      : Record<never, never> extends TParameters
        ? [input?: CommandControl & TParameters]
        : [input: CommandControl & TParameters];
