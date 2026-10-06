import type { ObservationDraft } from "@priemskiyyy/beacon";

import type { CheckResultLike } from "src/types/CheckResultLike";
import type { ExpoBody } from "src/types/ExpoBody";
import { ROLLBACK_IDENTITY } from "src/utils/constants/identities";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";

/**
 * The observation a check result stands for, whole: an available update and a
 * rollback to the embedded update are both offers, and a valid result with
 * neither is no offer, with the SDK's own reason kept as the detail. A
 * rejection never reaches here: it fails the check instead.
 */
export const readCheckResult = (
  result: CheckResultLike,
): ObservationDraft<ExpoBody> => {
  if (result.isAvailable) {
    return {
      status: "available",
      offer: {
        release: { identity: createUpdateIdentity(result.manifest.id) },
        kind: "update",
      },
    };
  }

  if (result.isRollBackToEmbedded) {
    return {
      status: "available",
      offer: {
        release: { identity: ROLLBACK_IDENTITY },
        kind: "rollback-to-embedded",
      },
    };
  }

  return { status: "none", reason: "no-decision", detail: result.reason };
};
