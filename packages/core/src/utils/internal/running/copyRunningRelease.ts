import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningRelease } from "src/types/RunningRelease";

const copyIdentity = (identity: ReleaseIdentity): ReleaseIdentity => {
  if (identity.status === "unknown") {
    return Object.freeze({ status: "unknown", reason: identity.reason });
  }

  return Object.freeze({
    status: "known",
    authority: identity.authority,
    domain: identity.domain,
    value: identity.value,
  });
};

/** Copies what a reader answered, so published facts are frozen and never shared with the application. */
export const copyRunningRelease = (release: RunningRelease): RunningRelease =>
  Object.freeze({
    identity: copyIdentity(release.identity),
    label: release.label,
    raw: Object.freeze({ ...release.raw }),
  });
