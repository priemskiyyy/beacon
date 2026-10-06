import type { OrderKind } from "src/types/OrderKind";

/**
 * What the application expects of one route in the manifest. The manifest
 * cannot change it: a `target` route only accepts a target or a none
 * decision, a `candidate` route only a candidate or a none decision, and a
 * decision of another kind is a validation error, never a mode switch.
 *
 * `domain` is what the ids of the route name, which a manifest may leave out
 * by writing a release's identity as a text, `"identity": "a91b44e"`: it is
 * then known, under `scope.application` as its authority and this domain.
 * A `target` route names `web-artifact` unless it declares another, which is
 * what a web build reads back. A `candidate` route has no default, so spell
 * it, such as `android-version-code` or `ios-build`; a text identity on a
 * route without one is refused.
 *
 * @example
 * ```ts
 * const web: RouteDeclaration = { kind: "target" };
 * const binary: RouteDeclaration = {
 *   kind: "candidate",
 *   order: "integer",
 *   domain: "android-version-code",
 * };
 * ```
 */
export type RouteDeclaration =
  | { kind: "target"; domain?: string }
  | { kind: "candidate"; order: OrderKind; domain?: string };
