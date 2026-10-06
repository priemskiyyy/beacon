import type { SupportState } from "src/types/SupportState";

/** No support policy is configured, so support is unknown and stays so. */
export const NO_POLICY_SUPPORT: SupportState = Object.freeze({
  revision: 0,
  status: "unknown",
  reason: "no-policy",
  evaluation: null,
  error: null,
});

/** A policy is configured and none has been accepted yet. */
export const NOT_CHECKED_SUPPORT: SupportState = Object.freeze({
  revision: 0,
  status: "unknown",
  reason: "not-checked",
  evaluation: null,
  error: null,
});
