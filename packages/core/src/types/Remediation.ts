/**
 * A route the policy names as a way to satisfy it. It names a configured route
 * and how much it matters, and it carries no handler: it neither promises the
 * route is usable now nor substitutes one route for another. `required` must
 * be done, `recommended` should be, and an `alternative` is one of several
 * ways.
 *
 * @example
 * ```ts
 * const remediation: Remediation<"binary"> = { route: "binary", level: "required" };
 * ```
 */
export type Remediation<TRoute extends string = string> = {
  route: TRoute;
  level: "required" | "recommended" | "alternative";
};
