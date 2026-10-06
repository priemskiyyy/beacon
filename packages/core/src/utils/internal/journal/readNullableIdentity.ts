import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import { readIdentity } from "src/utils/internal/journal/readIdentity";

type Read =
  { valid: true; identity: ReleaseIdentity | null } | { valid: false };

/** An identity that may be absent: `null` is a valid answer, and anything else must be an identity. */
export const readNullableIdentity = (value: unknown): Read => {
  if (value === null) {
    return { valid: true, identity: null };
  }

  const identity = readIdentity(value);

  if (identity === undefined) {
    return { valid: false };
  }

  return { valid: true, identity };
};
