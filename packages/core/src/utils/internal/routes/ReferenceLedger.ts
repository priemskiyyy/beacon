import type { OfferReference } from "src/types/OfferReference";
import type { PreparedReference } from "src/types/PreparedReference";

/**
 * Mints the references of one Beacon and remembers every one it minted, so a
 * copy, a forgery or a reference from another Beacon is refused by identity.
 */
export class ReferenceLedger {
  #minted = new WeakSet<object>();
  #count = 0;

  mintOffer = (route: string): OfferReference<string> => {
    this.#count += 1;

    const reference: OfferReference<string> = Object.freeze({
      kind: "offer",
      route,
      id: this.#count,
    });

    this.#minted.add(reference);

    return reference;
  };

  mintPrepared = (route: string): PreparedReference<string> => {
    this.#count += 1;

    const reference: PreparedReference<string> = Object.freeze({
      kind: "prepared",
      route,
      id: this.#count,
    });

    this.#minted.add(reference);

    return reference;
  };

  owns = (reference: object) => this.#minted.has(reference);
}
