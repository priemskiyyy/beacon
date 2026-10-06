/**
 * How a candidate version relates to the current one. `incomparable` is an
 * answer of its own: it is never read as equal, older or newer.
 *
 * @example
 * ```ts
 * const comparison: Comparison = semver().compare(candidate, current);
 * ```
 */
export type Comparison = "older" | "equal" | "newer" | "incomparable";
