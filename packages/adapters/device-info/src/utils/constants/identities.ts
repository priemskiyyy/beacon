import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import {
  ANOTHER_APPLICATION,
  APPLICATION_NOT_READ,
  BUILD_NOT_READ,
  UNSUPPORTED_PLATFORM,
} from "src/utils/constants/reasons";

/** A build nobody read is unknown, never build zero. */
export const BUILD_NOT_READ_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: BUILD_NOT_READ,
});

/** A build whose application nobody read has no authority to be named under. */
export const APPLICATION_NOT_READ_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: APPLICATION_NOT_READ,
});

/** The build numbers of another application say nothing about this one. */
export const ANOTHER_APPLICATION_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: ANOTHER_APPLICATION,
});

/** A scope that is not Android or iOS has no build number to name, and what is not asked is not guessed. */
export const UNSUPPORTED_PLATFORM_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: UNSUPPORTED_PLATFORM,
});
