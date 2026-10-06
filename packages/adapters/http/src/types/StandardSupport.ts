import type { RunningSubject } from "@priemskiyyy/beacon";

/**
 * The support facts of a manifest: a current denylist that the application's
 * own support policy reads. Nothing here decides support by itself, and the
 * remediation route is one the application declared.
 *
 * @example
 * ```ts
 * const support: StandardSupport<"web"> = {
 *   revision: "policy-43",
 *   subject: "web",
 *   deniedReleaseIds: ["web-build-b"],
 *   reasonCode: "known-regression",
 *   remediationRoute: "web",
 * };
 * ```
 */
export type StandardSupport<TRoute extends string> = {
  revision: string;
  subject: RunningSubject;
  deniedReleaseIds: string[];
  reasonCode: string;
  remediationRoute: TRoute;
};
