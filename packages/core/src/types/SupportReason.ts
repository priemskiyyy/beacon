import type { RunningSubject } from "src/types/RunningSubject";

/**
 * Why a policy reached its verdict: a machine-readable code of the
 * application's own, and the running subject it is about, or `null` when it
 * is about none in particular.
 *
 * @example
 * ```ts
 * const reason: SupportReason = { code: "native-build-too-old", subject: "native" };
 * ```
 */
export type SupportReason = {
  code: string;
  subject: RunningSubject | null;
};
