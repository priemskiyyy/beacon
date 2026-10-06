import type { RunningApplication, SupportVerdict } from "@priemskiyyy/beacon";

import type { LabSupport } from "example-shared/lab/types/LabSupport";

const UNKNOWN: SupportVerdict<"web"> = {
  status: "unknown",
  reasons: [{ code: "build-not-known", subject: "web" }],
  remediation: [],
};

/**
 * The application's policy: a build below the minimum, or one the service
 * ended, is unsupported, and the web route is the way out. A build nobody
 * reported is unknown, never version zero.
 */
export const evaluateSupport = (
  { minimumBuild, endedBuilds }: LabSupport,
  { web }: RunningApplication,
): SupportVerdict<"web"> => {
  if (web.state !== "known") {
    return UNKNOWN;
  }

  const build = web.release.raw["build"];

  if (typeof build !== "number") {
    return UNKNOWN;
  }

  if (endedBuilds.includes(build)) {
    return {
      status: "unsupported",
      reasons: [{ code: "build-ended", subject: "web" }],
      remediation: [{ route: "web", level: "required" }],
    };
  }

  if (build < minimumBuild) {
    return {
      status: "unsupported",
      reasons: [{ code: "below-minimum", subject: "web" }],
      remediation: [{ route: "web", level: "required" }],
    };
  }

  return { status: "supported", reasons: [], remediation: [] };
};
