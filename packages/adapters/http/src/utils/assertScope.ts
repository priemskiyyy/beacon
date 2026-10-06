import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { JsonRecord } from "src/types/internal/JsonRecord";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readText } from "src/utils/readText";

type ManifestScopeField = Exclude<keyof ReleaseScope, "partition">;

// A record makes the compiler name every field of a scope, so a new one cannot be left out. The partition is the client's, and no manifest names it.
const SCOPE_FIELDS: Record<ManifestScopeField, ManifestScopeField> = {
  application: "application",
  environment: "environment",
  platform: "platform",
  distribution: "distribution",
};

/** The manifest speaks for exactly the scope asked, in every field; one that differs is refused whole. */
export const assertScope = (record: JsonRecord, scope: ReleaseScope): void => {
  const mismatch = Object.values(SCOPE_FIELDS).find(
    (key) => readText(readField(record, key), key) !== scope[key],
  );

  if (mismatch === undefined) {
    return;
  }

  throw invalidManifest(`The manifest ${mismatch} is not the scope's.`);
};
