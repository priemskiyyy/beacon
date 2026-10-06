import type { Release } from "@priemskiyyy/beacon";

import { createBuildIdentity } from "example-shared/lab/utils/createBuildIdentity";

export const createBuildRelease = (build: number): Release => ({
  identity: createBuildIdentity(build),
  label: `Build ${build}`,
});
