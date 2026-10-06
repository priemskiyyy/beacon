import type { VersionStrategy } from "src/types/VersionStrategy";

/**
 * A version domain of your own. Return `incomparable` when two values belong to
 * different trains, and leave `admits` out when every parsed value may be
 * offered.
 *
 * @example
 * ```ts
 * const options: CustomVersionOptions<Revision, string> = {
 *   name: "release-train",
 *   parse: parseRevision,
 *   compare: (candidate, current) => {
 *     if (candidate.train !== current.train) {
 *       return "incomparable";
 *     }
 *
 *     return candidate.sequence > current.sequence ? "newer" : "older";
 *   },
 * };
 * ```
 */
export type CustomVersionOptions<TParsed, TInput> = Omit<
  VersionStrategy<TParsed, TInput>,
  "admits"
> & {
  admits?: (candidate: TParsed) => boolean;
};
