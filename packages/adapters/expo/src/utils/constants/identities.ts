import type { ReleaseIdentity } from "@priemskiyyy/beacon";

/** The identity of a rollback target: it is the embedded update, which the SDK does not name, so nothing identifies it. */
export const ROLLBACK_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: "embedded-rollback",
});
