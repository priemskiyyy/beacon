import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { UPDATE_AUTHORITY, UPDATE_DOMAIN } from "src/utils/constants/authority";

/** The identity of one update, by the id its server assigned. */
export const createUpdateIdentity = (id: string): ReleaseIdentity => ({
  status: "known",
  authority: UPDATE_AUTHORITY,
  domain: UPDATE_DOMAIN,
  value: id,
});
