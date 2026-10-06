import type { RunningApplication, SupportVerdict } from "@priemskiyyy/beacon";

import type { NativeManifest } from "src/lab/types/NativeManifest";

/** An update the backend ended is unsupported, and the OTA route is the way out; an unread bundle is unknown. */
export const evaluateNativeSupport = (
  { endedUpdates }: NativeManifest,
  { bundle }: RunningApplication,
): SupportVerdict<"ota"> => {
  if (bundle.state !== "known" || bundle.release.identity.status !== "known") {
    return {
      status: "unknown",
      reasons: [{ code: "bundle-not-known", subject: "bundle" }],
      remediation: [],
    };
  }

  if (endedUpdates.includes(bundle.release.identity.value)) {
    return {
      status: "unsupported",
      reasons: [{ code: "update-ended", subject: "bundle" }],
      remediation: [{ route: "ota", level: "required" }],
    };
  }

  return { status: "supported", reasons: [], remediation: [] };
};
