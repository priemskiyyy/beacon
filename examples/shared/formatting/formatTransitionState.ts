import type { TransitionState } from "@priemskiyyy/beacon";

import { formatReconciliation } from "example-shared/formatting/formatReconciliation";

export const formatTransitionState = ({ journal, latest }: TransitionState) => {
  if (latest === null) {
    return `Journal ${journal}, no intent recorded`;
  }

  return `Journal ${journal}: ${formatReconciliation(latest)}`;
};
