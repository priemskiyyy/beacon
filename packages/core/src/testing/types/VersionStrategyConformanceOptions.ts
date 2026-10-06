import type { VersionStrategy } from "src/types/VersionStrategy";

/**
 * What a strategy's conformance suite is run over: a name for the report, a
 * `create` for the strategy, inputs it must accept from oldest to newest, and
 * inputs it must reject.
 *
 * @example
 * ```ts
 * const options: VersionStrategyConformanceOptions<number, string> = {
 *   name: "build-number",
 *   create: () => buildNumbers,
 *   ascending: ["9", "10"],
 *   invalid: ["latest"],
 * };
 * ```
 */
export type VersionStrategyConformanceOptions<TParsed, TInput> = {
  name: string;
  create: () => VersionStrategy<TParsed, TInput>;
  /** Inputs the strategy must accept, from oldest to newest, at least two. */
  ascending: TInput[];
  /** Inputs the strategy must reject by throwing. */
  invalid: TInput[];
};
