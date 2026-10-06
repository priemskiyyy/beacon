import type { Offer } from "src/types/Offer";
import type { OfferReference } from "src/types/OfferReference";
import type { Prepared } from "src/types/Prepared";
import type { PreparedReference } from "src/types/PreparedReference";
import type { RouteBody } from "src/types/RouteBody";

/** What a route method is called with, at its widest: the offer or prepared target, or its reference, the caller's signal, and the parameters beside them. */
export type CommandInput = {
  offer?: Offer<string, RouteBody> | OfferReference<string>;
  prepared?: Prepared<string, RouteBody> | PreparedReference<string>;
  signal?: AbortSignal;
};
