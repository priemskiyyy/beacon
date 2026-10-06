import type { ManifestLimits } from "src/types/ManifestLimits";

/** The schema version this parser reads; a manifest of another version is refused. */
export const SCHEMA_VERSION = 1;

/** Documented defaults, and the tunables of `limits`. */
export const DEFAULT_LIMITS: ManifestLimits = {
  bytes: 262_144,
  lifetime: 86_400_000,
  skew: 300_000,
};

/** The longest text a manifest may carry in one field. */
export const MAXIMUM_TEXT_LENGTH = 256;

/** The most items a manifest list may hold. */
export const MAXIMUM_LIST_LENGTH = 256;

/** The most entries a release may carry as metadata. */
export const MAXIMUM_METADATA_ENTRIES = 16;

/** Keys that could corrupt a registry built from a document. */
export const UNSAFE_KEYS = ["__proto__", "constructor", "prototype"];
