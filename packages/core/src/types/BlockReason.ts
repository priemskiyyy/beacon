/**
 * Why a disruptive command may not run now: a machine-readable code, and the
 * participant that asked for it, or `null` when Beacon itself did. Codes such
 * as `unsaved-draft` are the application's own. Beacon raises
 * `operation-in-progress`, `operation-indeterminate` and `safety-changed` for
 * itself, and `reservation-failed`, `settlement-timeout` and
 * `settlement-failed` for a participant that failed to answer.
 *
 * @example
 * ```ts
 * const reason: BlockReason = { code: "unsaved-draft", participant: { name: "drafts" } };
 * ```
 */
export type BlockReason = {
  code: string;
  participant: { name: string } | null;
};
