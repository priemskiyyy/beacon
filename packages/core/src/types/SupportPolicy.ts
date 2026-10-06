import type { Projection } from "src/types/Projection";
import type { RunningApplication } from "src/types/RunningApplication";
import type { SupportVerdict } from "src/types/SupportVerdict";

/**
 * The application's own support policy: a view of a source's document, and a
 * pure synchronous function of that policy and what is running. `evaluate`
 * cannot fetch, open a modal, start a download or import code, and a running
 * subject that is not `known` is a state it must handle, never version zero.
 * A policy that names a route the Beacon does not have does not compile.
 *
 * @example
 * ```ts
 * const policy = supportPolicy({
 *   source: manifest.select((document) => document.support),
 *   evaluate: (support, running) => evaluateSupport(support, running),
 * });
 * ```
 */
export type SupportPolicy<TDocument, TPolicy, TRoute extends string> = {
  source: Projection<TDocument, TPolicy>;
  evaluate(
    policy: TPolicy,
    running: RunningApplication,
  ): SupportVerdict<TRoute>;
};
