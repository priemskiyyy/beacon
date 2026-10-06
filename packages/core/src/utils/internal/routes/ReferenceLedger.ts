import type { OfferReference } from "src/types/OfferReference";
import type { PreparedReference } from "src/types/PreparedReference";

/**
 * Mints the references of one Beacon and remembers every one it minted, so a
 * copy, a forgery or a reference from another Beacon is refused by identity.
 */
export class ReferenceLedger {
  #minted = new WeakSet<object>();
  #count = 0;

  mintOffer = (route: string): OfferReference<string> =>
    this.#remember({ kind: "offer", route, id: this.#nextId() });

  mintPrepared = (route: string): PreparedReference<string> =>
    this.#remember({ kind: "prepared", route, id: this.#nextId() });

  owns = (reference: object) => this.#minted.has(reference);

  // Numbered across both kinds, so no two references of one Beacon share an id.
  #nextId() {
    this.#count += 1;

    return this.#count;
  }

  #remember<TReference extends object>(reference: TReference) {
    this.#minted.add(Object.freeze(reference));

    return reference;
  }
}
