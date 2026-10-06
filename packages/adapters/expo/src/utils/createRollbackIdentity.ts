import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { EMBEDDED_ROLLBACK } from "src/utils/constants/reasons";

/** The identity of a rollback target, which is the embedded update and is not named by the SDK. */
export const createRollbackIdentity = (): ReleaseIdentity => ({
  status: "unknown",
  reason: EMBEDDED_ROLLBACK,
});
