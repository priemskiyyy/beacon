import type { CodePushPrepared } from "src/types/CodePushPrepared";
import type { LocalPackageLike } from "src/types/LocalPackageLike";
import { createPackageIdentity } from "src/utils/createPackageIdentity";
import { readLabel } from "src/utils/readLabel";

/** The prepared target CodePush's pending package stands for, or `null` when it lists none, or one whose hash names nothing: what cannot be identified is not vouched for. */
export const readPending = (
  pending: LocalPackageLike | null,
): CodePushPrepared | null => {
  if (pending === null) {
    return null;
  }

  const identity = createPackageIdentity(pending.packageHash);

  if (identity.status === "unknown") {
    return null;
  }

  return {
    release: { identity },
    label: readLabel(pending.label),
    mandatory: pending.isMandatory === true,
  };
};
