/** The longest SemVer string `semver()` parses, which bounds every identifier it holds. */
export const MAX_SEMVER_LENGTH = 256;

/** The most digits `integer()` accepts, far beyond any platform's version code. */
export const MAX_INTEGER_DIGITS = 64;

/** The Semantic Versioning 2.0.0 grammar, as published at semver.org. */
export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** A canonical unsigned decimal: no sign, fraction, exponent, whitespace or leading zero. */
export const CANONICAL_DECIMAL_PATTERN = /^(0|[1-9][0-9]*)$/;

/** The identifiers of a prerelease that order as numbers. */
export const NUMERIC_IDENTIFIER_PATTERN = /^[0-9]+$/;
