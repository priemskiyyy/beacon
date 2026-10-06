/**
 * What a participant answers once it has settled its work for a command: it is
 * `ready`, or its `code` says why the command must not go on, such as a draft
 * that could not be saved.
 *
 * @example
 * ```ts
 * const settlement: Settlement = { status: "blocked", code: "draft-not-saved" };
 * ```
 */
export type Settlement =
  { status: "ready" } | { status: "blocked"; code: string };
