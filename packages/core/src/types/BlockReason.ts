/**
 * Why a disruptive command may not run now: a machine-readable code, and the
 * participant that asked for it, or `null` when Beacon itself did. Codes such
 * as `unsaved-draft` are the application's own; Beacon raises
 * `operation-in-progress`, `operation-indeterminate` and `safety-changed`.
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
