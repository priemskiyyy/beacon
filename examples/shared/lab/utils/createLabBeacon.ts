import {
  Beacon,
  supportPolicy,
  targetRoute,
} from "@priemskiyyy/beacon";
import type {
  BeaconClock,
  JournalStorage,
  ReleaseSource,
} from "@priemskiyyy/beacon";

import {
  CHECK_TIMEOUT,
  JOURNAL_BUDGET,
  SCOPE,
} from "example-shared/lab/constants/lab";
import type { LabManifest } from "example-shared/lab/types/LabManifest";
import type { LabNative } from "example-shared/lab/types/LabNative";
import { createReloadMechanism } from "example-shared/lab/utils/createReloadMechanism";
import { createRunningBuild } from "example-shared/lab/utils/createRunningBuild";
import { evaluateSupport } from "example-shared/lab/utils/evaluateSupport";

type LabBeaconOptions = {
  boot: { id: string };
  /** The build this document runs, or `null` when it cannot say which. */
  build: number | null;
  manifest: ReleaseSource<LabManifest>;
  browser: LabNative;
  storage: JournalStorage;
  clock: BeaconClock;
};

/**
 * One Beacon per document: a web route over the release service, the
 * application's support policy over the same read, and a journal that the
 * next document reads back.
 */
export const createLabBeacon = ({
  boot,
  build,
  manifest,
  browser,
  storage,
  clock,
}: LabBeaconOptions) => {
  const web = targetRoute({
    subject: "web",
    source: manifest.select((document) => document.web),
    mechanism: createReloadMechanism(browser),
  });

  return new Beacon({
    scope: SCOPE,
    running: {
      boot,
      web: () => {
        if (build === null) {
          return {
            identity: { status: "unknown", reason: "not-reported" },
            label: null,
            raw: {},
          };
        }

        return createRunningBuild(build);
      },
    },
    routes: { web },
    policy: supportPolicy({
      source: manifest.select((document) => document.support),
      evaluate: evaluateSupport,
    }),
    journal: { mode: "required", storage, budget: JOURNAL_BUDGET },
    timeouts: { check: CHECK_TIMEOUT },
    clock,
  });
};
