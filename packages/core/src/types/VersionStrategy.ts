import type { Comparison } from "src/types/Comparison";

/**
 * How one domain of versions is parsed, ordered and admitted. `parse` is
 * strict and throws a `BeaconError` with the code `INVALID_VERSION` for input
 * outside the domain. `compare` is pure, deterministic and synchronous, and
 * receives parsed values of this one domain. `admits` says whether a candidate
 * may be offered at all, whatever its order.
 *
 * @example
 * ```ts
 * const strategy: VersionStrategy<number, string> = {
 *   name: "build-number",
 *   parse: (input) => Number(input),
 *   compare: (candidate, current) => (candidate > current ? "newer" : "older"),
 *   admits: () => true,
 * };
 * ```
 */
export type VersionStrategy<TParsed, TInput> = {
  name: string;
  parse: (input: TInput) => TParsed;
  compare: (candidate: TParsed, current: TParsed) => Comparison;
  admits: (candidate: TParsed) => boolean;
};
