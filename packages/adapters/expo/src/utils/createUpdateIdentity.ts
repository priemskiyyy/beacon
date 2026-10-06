import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { UPDATE_AUTHORITY, UPDATE_DOMAIN } from "src/utils/constants/authority";

/** The identity of one update, by the id its server assigned. An id is a UUID, the same in any case, and the SDK writes the running update's in lowercase, so this does too. */
export const createUpdateIdentity = (id: string): ReleaseIdentity => ({
  status: "known",
  authority: UPDATE_AUTHORITY,
  domain: UPDATE_DOMAIN,
  value: id.toLowerCase(),
});
