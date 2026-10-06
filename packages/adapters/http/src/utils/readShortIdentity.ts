import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import type { IdentityShorthand } from "src/types/internal/IdentityShorthand";
import { invalidManifest } from "src/utils/invalidManifest";
import { readText } from "src/utils/readText";

/** The known identity a text stands for, in the authority and domain of its route. */
export const readShortIdentity = (
  value: string,
  field: string,
  { authority, domain }: IdentityShorthand,
): ReleaseIdentity => {
  if (domain === null) {
    throw invalidManifest(
      `${field} is a text, which needs the route to declare the domain of its ids.`,
    );
  }

  return { status: "known", authority, domain, value: readText(value, field) };
};
