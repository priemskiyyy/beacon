import type { Release } from "@priemskiyyy/beacon";

/** A worker update names no build: the script bytes can change at the same URL, so nothing is claimed. */
export const UNKNOWN_WORKER_RELEASE: Release = Object.freeze({
  identity: Object.freeze({
    status: "unknown",
    reason: "worker-build-unknown",
  }),
});
