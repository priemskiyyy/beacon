import type { Compatibility } from "src/types/Compatibility";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";

/** What selection reads of a release, whatever else it carries. */
export type ReleaseFacts = {
  identity: ReleaseIdentity;
  compatibility?: Compatibility;
};
