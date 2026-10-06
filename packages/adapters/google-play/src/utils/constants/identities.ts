import type { ReleaseIdentity } from "@priemskiyyy/beacon";

/** The identity of a flow Play holds: it names no version for it. */
export const IN_PROGRESS_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: "play-update-in-progress",
});

/** The identity of a download an install event reports: an event names no version. */
export const DOWNLOADED_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: "play-update-downloaded",
});
