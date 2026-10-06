import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { formatIdentity } from "example-shared/formatting/formatIdentity";

type ReleaseLike = { identity: ReleaseIdentity; label?: string | null };

/** A release the way people name it, with the identity that tells it apart. */
export const formatRelease = ({ identity, label }: ReleaseLike) => {
  if (label === undefined || label === null) {
    return formatIdentity(identity);
  }

  return `${label} (${formatIdentity(identity)})`;
};
