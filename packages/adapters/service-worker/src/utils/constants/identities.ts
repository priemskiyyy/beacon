import type { ReleaseIdentity } from "@priemskiyyy/beacon";

/** A worker update names no build: the script bytes can change at the same URL, so nothing is claimed. */
export const UNKNOWN_WORKER_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: "worker-build-unknown",
});
