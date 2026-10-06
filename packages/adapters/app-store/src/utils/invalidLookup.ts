import { BeaconError } from "@priemskiyyy/beacon";

/** The refusal of a lookup that breaks its contract: an invalid document, never repaired into an answer. */
export const invalidLookup = (message: string) =>
  new BeaconError({ code: "INVALID_DOCUMENT", message });
