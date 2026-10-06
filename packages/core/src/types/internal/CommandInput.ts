import type { OfferReference } from "src/types/OfferReference";
import type { PreparedReference } from "src/types/PreparedReference";

/** What a route method is called with, at its widest: the references, the caller's signal, and the parameters beside them. */
export type CommandInput = {
  offer?: OfferReference<string>;
  prepared?: PreparedReference<string>;
  signal?: AbortSignal;
};
