import { BeaconError } from "@priemskiyyy/beacon";

/** The error every rule of the standard manifest raises: the document breaks its contract. */
export const invalidManifest = (message: string) =>
  new BeaconError({ code: "INVALID_DOCUMENT", message });
