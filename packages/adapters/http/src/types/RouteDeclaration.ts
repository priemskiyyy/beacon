import type { OrderKind } from "src/types/OrderKind";

/**
 * What the application expects of one route in the manifest. The manifest
 * cannot change it: a `target` route only accepts a target or a none
 * decision, a `candidate` route only a candidate or a none decision, and a
 * decision of another kind is a validation error, never a mode switch.
 *
 * @example
 * ```ts
 * const web: RouteDeclaration = { kind: "target" };
 * const binary: RouteDeclaration = { kind: "candidate", order: "text" };
 * ```
 */
export type RouteDeclaration =
  { kind: "target" } | { kind: "candidate"; order: OrderKind };
