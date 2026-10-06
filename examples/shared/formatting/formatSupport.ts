import type { SupportState } from "@priemskiyyy/beacon";

import { SUPPORT_UNKNOWN_LABELS } from "example-shared/lab/constants/labels";

/** What the policy says, and why: its own reason codes, or the reason Beacon could not ask it. */
export const formatSupport = ({ status, reason, evaluation }: SupportState) => {
  if (reason !== null) {
    return `${status}: ${SUPPORT_UNKNOWN_LABELS[reason]}`;
  }

  const codes = evaluation?.reasons.map(({ code }) => code) ?? [];

  if (codes.length === 0) {
    return status;
  }

  return `${status}: ${codes.join(", ")}`;
};
