import type { NoneDecision, TargetDecision } from "@priemskiyyy/beacon";

import type { LabWorld } from "example-shared/lab/types/LabWorld";
import { createBuildRelease } from "example-shared/lab/utils/createBuildRelease";

export const createDecision = ({
  decision,
  deployed,
}: LabWorld): TargetDecision | NoneDecision => {
  if (decision === "none") {
    return { kind: "none", reason: "up-to-date" };
  }

  return { kind: "target", release: createBuildRelease(deployed) };
};
