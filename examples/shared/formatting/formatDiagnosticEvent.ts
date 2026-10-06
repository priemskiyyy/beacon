import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";

import { DIAGNOSTIC_LABELS } from "example-shared/lab/constants/labels";

/** One diagnostic event: what happened, and the names and numbers Beacon attached to it. */
export const formatDiagnosticEvent = ({
  type,
  route,
  command,
  attempt,
  operation,
  reason,
}: BeaconDiagnosticEvent) => {
  const target = [route, command].filter((part) => part !== null).join(".");

  const numbers = [
    attempt === null ? null : `attempt ${attempt}`,
    operation === null ? null : `operation ${operation}`,
    reason,
  ].filter((part) => part !== null);

  const details = [target, ...numbers].filter((part) => part !== "");

  if (details.length === 0) {
    return DIAGNOSTIC_LABELS[type];
  }

  return `${DIAGNOSTIC_LABELS[type]} (${details.join(", ")})`;
};
