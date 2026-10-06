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
export const supportPolicy = <TDocument, TPolicy, TRoute extends string>(
  policy: SupportPolicy<TDocument, TPolicy, TRoute>,
): SupportPolicy<TDocument, TPolicy, TRoute> => policy;
