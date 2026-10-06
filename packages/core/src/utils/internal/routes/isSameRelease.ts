import type { Release } from "src/types/Release";
import { isSameData } from "src/utils/internal/common/isSameData";

/**
 * Whether two releases are the one the user was shown. A known identity is the
 * same by its authority, domain and value, so a refreshed label or metadata
 * keeps the offer; an unknown identity names nothing, so only the same data
 * is the same.
 */
export const isSameRelease = (
  previous: Release<object | null>,
  next: Release<object | null>,
) => {
  if (
    previous.identity.status === "known" &&
    next.identity.status === "known"
  ) {
    return isSameData(previous.identity, next.identity);
  }

  return isSameData(previous, next);
};
