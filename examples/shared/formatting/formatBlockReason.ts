import type { BlockReason } from "@priemskiyyy/beacon";

import { BLOCK_LABELS } from "example-shared/lab/constants/labels";

export const formatBlockReason = ({ code, participant }: BlockReason) => {
  const label = BLOCK_LABELS[code] ?? code;

  if (participant === null) {
    return `${code}: ${label}`;
  }

  return `${code}: ${label} (asked by ${participant.name})`;
};
