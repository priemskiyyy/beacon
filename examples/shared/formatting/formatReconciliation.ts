import type { Reconciliation } from "@priemskiyyy/beacon";

import { formatIdentity } from "example-shared/formatting/formatIdentity";
import { RECONCILIATION_LABELS } from "example-shared/lab/constants/labels";

/** What the journal recorded before the reload, and what the boot that followed says about it. */
export const formatReconciliation = ({
  intent,
  outcome,
  attempts,
  exhausted,
}: Reconciliation) => {
  const target = formatIdentity(
    intent.target ?? { status: "unknown", reason: "no-target" },
  );

  const budget = exhausted ? ", attempt budget spent" : "";

  return `${intent.command} on ${intent.route} aimed at ${target}: ${outcome}, ${RECONCILIATION_LABELS[outcome]} (unreached boots in a row: ${attempts}${budget})`;
};
