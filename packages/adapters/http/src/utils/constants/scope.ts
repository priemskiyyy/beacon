import type { ReleaseScope } from "@priemskiyyy/beacon";

type ManifestScopeField = Exclude<keyof ReleaseScope, "partition">;

/** Every field of a scope a manifest states, which it has to repeat exactly; the partition is the client's, and no manifest names it. */
export const SCOPE_FIELDS: Record<ManifestScopeField, ManifestScopeField> = {
  application: "application",
  environment: "environment",
  platform: "platform",
  distribution: "distribution",
};
