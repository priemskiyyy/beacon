import type { CustomVersionOptions } from "src/types/CustomVersionOptions";
import type { VersionStrategy } from "src/types/VersionStrategy";

/**
 * A version domain of your own, such as a calendar version or a release
 * train. The parser is yours to validate; nothing accepts a value merely
 * because TypeScript infers the shape.
 *
 * @example
 * ```ts
 * const strategy = custom<Revision, string>({
 *   name: "release-train",
 *   parse: parseRevision,
 *   compare: (candidate, current) => {
 *     if (candidate.train !== current.train) {
 *       return "incomparable";
 *     }
 *
 *     return candidate.sequence > current.sequence ? "newer" : "older";
 *   },
 * });
 * ```
 */
export const custom = <TParsed, TInput>({
  name,
  parse,
  compare,
  admits = () => true,
}: CustomVersionOptions<TParsed, TInput>): VersionStrategy<
  TParsed,
  TInput
> => ({
  name,
  parse,
  compare,
  admits,
});
