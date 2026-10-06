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

/** The manifest speaks for the scope asked, in every field it echoes; one that differs is refused whole. A field it does not echo is the one the request made, since a manifest is fetched for one scope. */
export const assertScope = (record: JsonRecord, scope: ReleaseScope): void => {
  const mismatch = Object.values(SCOPE_FIELDS).find((key) => {
    const echoed = readField(record, key);

    return echoed !== undefined && readText(echoed, key) !== scope[key];
  });

  if (mismatch === undefined) {
    return;
  }

  throw invalidManifest(`The manifest ${mismatch} is not the scope's.`);
};
