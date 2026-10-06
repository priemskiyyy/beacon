/**
 * How tightly a command is bound to what the user was shown, which is never
 * tighter than its provider allows.
 *
 * - `unpinned-navigation`: the next navigation receives whatever is deployed.
 * - `provider-current`: the provider acts on its own current selection, which
 *   may differ from the offer that was shown.
 * - `exact-instance`: the command is bound to one observed instance.
 * - `store-destination`: the command opens a store page, not a binary.
 *
 * @example
 * ```ts
 * const binding: TargetBinding = "unpinned-navigation";
 * ```
 */
export type TargetBinding =
  | "unpinned-navigation"
  | "provider-current"
  | "exact-instance"
  | "store-destination";
