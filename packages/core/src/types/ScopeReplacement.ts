/**
 * How `replaceScope` settled. `replaced` means the next scope is in force and
 * everything the last one taught was forgotten. `unchanged` means the scope
 * was already the current one, so nothing was touched. `blocked` names a route
 * whose operation is running or unresolved: the underlying work cannot be
 * given to another scope, so acknowledge it first.
 *
 * @example
 * ```ts
 * const replacement = beacon.replaceScope({ ...scope, environment: "staging" });
 *
 * if (replacement.status === "blocked") {
 *   console.warn(replacement.route);
 * }
 * ```
 */
export type ScopeReplacement =
  | { status: "replaced" }
  | { status: "unchanged" }
  | { status: "blocked"; route: string };
