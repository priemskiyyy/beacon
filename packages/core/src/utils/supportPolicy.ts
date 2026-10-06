import type { SupportPolicy } from "src/types/SupportPolicy";

/**
 * Declares a support policy so that the document, the policy view and the
 * route names it may name are inferred together: `evaluate` receives the view
 * the source projected, typed, and a remediation naming a route that is not
 * in the Beacon fails to compile.
 *
 * @example
 * ```ts
 * const policy = supportPolicy({
 *   source: manifest.select((document) => document.support),
 *   evaluate: evaluateSupport,
 * });
 * ```
 */
export const supportPolicy = <
  TDocument,
  TPolicy,
  TRoute extends string = never,
>(
  policy: SupportPolicy<TDocument, TPolicy, TRoute>,
  // Only a remediation names a route: written inline in the options of a Beacon, the Beacon's own routes are no evidence of which one the policy sends a user to.
): SupportPolicy<TDocument, TPolicy, NoInfer<TRoute>> => policy;
