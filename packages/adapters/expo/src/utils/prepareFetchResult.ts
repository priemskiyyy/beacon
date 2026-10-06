import type { PreparedDraft, ReleaseIdentity } from "@priemskiyyy/beacon";

import type { ExpoBody } from "src/types/ExpoBody";
import type { ExpoDownloadReceipt } from "src/types/ExpoDownloadReceipt";
import type { FetchResultLike } from "src/types/FetchResultLike";
import { ROLLBACK_IDENTITY } from "src/utils/constants/identities";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";
import { relateToOffer } from "src/utils/relateToOffer";

type Preparation = {
  /** What the provider now has prepared, or `null` when the answer prepared nothing new. */
  prepared: PreparedDraft<ExpoBody> | null;
  receipt: ExpoDownloadReceipt;
};

/**
 * What a fetch result prepared, whole: a new update and a rollback to the
 * embedded update are prepared targets, and a valid answer that is neither is
 * a receipt that prepared nothing, never a manufactured prepared update. The
 * receipt relates the result to the offer the user was shown, since the
 * provider fetches its own current selection.
 */
export const prepareFetchResult = (
  result: FetchResultLike,
  offered: ReleaseIdentity,
): Preparation => {
  if (result.isNew) {
    const identity = createUpdateIdentity(result.manifest.id);

    return {
      prepared: {
        status: "ready",
        value: { release: { identity }, kind: "update" },
      },
      receipt: {
        kind: "update-prepared",
        update: { id: result.manifest.id },
        offered: relateToOffer(identity, offered),
      },
    };
  }

  if (result.isRollBackToEmbedded) {
    return {
      prepared: {
        status: "ready",
        value: {
          release: { identity: ROLLBACK_IDENTITY },
          kind: "rollback-to-embedded",
        },
      },
      receipt: {
        kind: "rollback-prepared",
        offered: relateToOffer(ROLLBACK_IDENTITY, offered),
      },
    };
  }

  return { prepared: null, receipt: { kind: "no-new-preparation" } };
};
