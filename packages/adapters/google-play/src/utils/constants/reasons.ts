/** Why a flow is unsupported: Play does not allow it for this update now. */
export const FLOW_NOT_ALLOWED = "flow-not-allowed";

/** Why the store handoff is unsupported: the scope is not a Google Play distribution, so the store page would be the wrong one. */
export const OTHER_DISTRIBUTION = "other-distribution";

/** Why the store route has no offer: it is a handoff over no authority, and nothing tells it what the store has. */
export const NO_LOOKUP = "no-lookup";
