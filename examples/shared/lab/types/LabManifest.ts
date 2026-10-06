import type { NoneDecision, TargetDecision } from "@priemskiyyy/beacon";

import type { LabSupport } from "example-shared/lab/types/LabSupport";

/** What the release service answers: the decision for the web route and the support policy. */
export type LabManifest = {
  web: TargetDecision | NoneDecision;
  support: LabSupport;
};
