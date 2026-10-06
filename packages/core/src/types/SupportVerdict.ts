import type { Remediation } from "src/types/Remediation";
import type { SupportReason } from "src/types/SupportReason";
import type { SupportStatus } from "src/types/SupportStatus";

/**
 * What a policy's `evaluate` answers: the status, why, and the routes that
 * would satisfy it. A requirement is satisfied only by newly observed running
 * facts or a new accepted policy, never by a click, a store page opened, a
 * download or a provider's consent.
 *
 * @example
 * ```ts
 * const verdict: SupportVerdict<"binary"> = {
 *   status: "unsupported",
 *   reasons: [{ code: "native-build-too-old", subject: "native" }],
 *   remediation: [{ route: "binary", level: "required" }],
 * };
 * ```
 */
export type SupportVerdict<TRoute extends string = string> = {
  status: SupportStatus;
  reasons: SupportReason[];
  remediation: Array<Remediation<TRoute>>;
};
