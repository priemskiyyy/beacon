import type { RunningFact } from "@priemskiyyy/beacon";
import { match } from "ts-pattern";

import { formatRelease } from "example-shared/formatting/formatRelease";

export const formatRunningFact = (fact: RunningFact) =>
  match(fact)
    .with({ state: "unconfigured" }, () => "No reader configured")
    .with({ state: "pending" }, () => "Not read yet")
    .with({ state: "known" }, ({ release }) => formatRelease(release))
    .with({ state: "failed" }, ({ error }) => `Failed: ${error.code}`)
    .exhaustive();
