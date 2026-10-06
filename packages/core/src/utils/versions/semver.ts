import type { SemVer } from "src/types/SemVer";
import type { SemVerOptions } from "src/types/SemVerOptions";
import type { VersionStrategy } from "src/types/VersionStrategy";
import { compareSemVer } from "src/utils/internal/versions/compareSemVer";
import { parseSemVer } from "src/utils/internal/versions/parseSemVer";

/**
 * Strict Semantic Versioning 2.0.0: it rejects a leading `v`, a missing
 * component and every other near miss instead of guessing, orders by
 * precedence and ignores build metadata. Prereleases are excluded from offers
 * unless `prereleases` says `include`.
 *
 * @example
 * ```ts
 * const strategy = semver({ prereleases: "exclude" });
 * const newer = strategy.compare(strategy.parse("2.4.0"), strategy.parse("2.3.9"));
 * ```
 */
export const semver = ({
  prereleases = "exclude",
}: SemVerOptions = {}): VersionStrategy<SemVer, string> => ({
  name: "semver",
  parse: parseSemVer,
  compare: compareSemVer,
  admits: (candidate) => {
    if (prereleases === "include") {
      return true;
    }

    return candidate.prerelease.length === 0;
  },
});
