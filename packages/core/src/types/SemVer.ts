import type { SemVerIdentifier } from "src/types/SemVerIdentifier";

/**
 * A strictly parsed Semantic Versioning 2.0.0 string. The numeric fields are
 * canonical decimal strings, so no size rounds them, and the raw label stays
 * beside the parsed fields. Build metadata never affects precedence.
 *
 * @example
 * ```ts
 * const version: SemVer = semver().parse("2.4.0-beta.1+build.7");
 * ```
 */
export type SemVer = {
  raw: string;
  major: string;
  minor: string;
  patch: string;
  prerelease: SemVerIdentifier[];
  build: string[];
};
