import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { APPLICATION, ARTIFACT_DOMAIN } from "example-shared/lab/constants/lab";

/** The identity of a build: the application assigns it, and no label or number stands in for it. */
export const createBuildIdentity = (build: number): ReleaseIdentity => ({
  status: "known",
  authority: APPLICATION,
  domain: ARTIFACT_DOMAIN,
  value: `web-build-${build}`,
});
