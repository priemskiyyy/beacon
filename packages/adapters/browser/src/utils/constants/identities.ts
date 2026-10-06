import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { BUILD_ID_NOT_INJECTED } from "src/utils/constants/reasons";

/** A build id nobody injected is unknown, never a build named `undefined`. */
export const BUILD_ID_NOT_INJECTED_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: BUILD_ID_NOT_INJECTED,
});
