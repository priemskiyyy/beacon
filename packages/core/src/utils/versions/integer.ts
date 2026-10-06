import type { VersionStrategy } from "src/types/VersionStrategy";
import { compareDecimals } from "src/utils/internal/versions/compareDecimals";
import { parseInteger } from "src/utils/internal/versions/parseInteger";

/**
 * Non-negative integers, such as an Android version code or a build number.
 * It accepts safe integers and canonical decimal strings, compares them
 * exactly beyond `Number.MAX_SAFE_INTEGER`, and rejects signs, fractions,
 * exponents, leading zeros and whitespace.
 *
 * @example
 * ```ts
 * const strategy = integer();
 * const older = strategy.compare(strategy.parse(108), strategy.parse("112"));
 * ```
 */
export const integer = (): VersionStrategy<string, number | string> => ({
  name: "integer",
  parse: parseInteger,
  compare: compareDecimals,
  admits: () => true,
});
