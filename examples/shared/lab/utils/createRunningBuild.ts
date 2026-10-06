import type { RunningRelease } from "@priemskiyyy/beacon";

import { createBuildIdentity } from "example-shared/lab/utils/createBuildIdentity";

/** What the running document reports about itself; the number is the platform's raw value, kept apart from the identity. */
export const createRunningBuild = (build: number): RunningRelease => ({
  identity: createBuildIdentity(build),
  label: `Build ${build}`,
  raw: { build },
});
