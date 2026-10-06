import type { ManifestLimits } from "src/types/ManifestLimits";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";

/** The limits a manifest is held to: what the application set, and the default for every limit it left out, one set to `undefined` included, as a variable that was never defined gives. */
export const resolveLimits = (
  limits: Partial<ManifestLimits> | undefined,
): ManifestLimits => ({
  bytes: limits?.bytes ?? DEFAULT_LIMITS.bytes,
  lifetime: limits?.lifetime ?? DEFAULT_LIMITS.lifetime,
  skew: limits?.skew ?? DEFAULT_LIMITS.skew,
});
