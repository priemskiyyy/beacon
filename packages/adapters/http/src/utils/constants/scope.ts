import type { ReleaseScope } from "@priemskiyyy/beacon";

/** Every field of a scope, which a manifest has to repeat exactly. */
export const SCOPE_FIELDS: Record<keyof ReleaseScope, keyof ReleaseScope> = {
  application: "application",
  environment: "environment",
  platform: "platform",
  distribution: "distribution",
};
