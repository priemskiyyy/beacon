import { INITIAL_BUILD } from "example-shared/lab/constants/lab";
import type { LabWorld } from "example-shared/lab/types/LabWorld";

export const createWorld = (): LabWorld => ({
  revision: 1,
  deployed: INITIAL_BUILD,
  served: INITIAL_BUILD,
  decision: "target",
  minimumBuild: INITIAL_BUILD,
  endedBuilds: [],
  failing: false,
  slow: false,
  lagging: false,
  held: 0,
  expiresAt: null,
});
