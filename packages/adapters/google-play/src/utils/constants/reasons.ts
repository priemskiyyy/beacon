/** Why an identity is unknown: Play holds a flow but names no version for it. */
export const IN_PROGRESS_IDENTITY = "play-update-in-progress";

/** Why an identity is unknown: an update was downloaded and no version was seen for it. */
export const DOWNLOADED_IDENTITY = "play-update-downloaded";

/** Why a flow is unsupported: Play does not allow it for this update now. */
export const FLOW_NOT_ALLOWED = "flow-not-allowed";
