import type { ReleaseScope } from "src/types/ReleaseScope";
import {
  JOURNAL_NAMESPACE,
  JOURNAL_VERSION,
} from "src/utils/constants/journal";

/** The key of one scope's record, partitioned by application, environment, platform and distribution, so no scope reads another's. */
export const createJournalKey = ({
  application,
  environment,
  platform,
  distribution,
}: ReleaseScope) =>
  [
    JOURNAL_NAMESPACE,
    `v${JOURNAL_VERSION}`,
    application,
    environment,
    platform,
    distribution,
  ]
    .map(encodeURIComponent)
    .join("/");
