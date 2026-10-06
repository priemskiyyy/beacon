import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { JsonRecord } from "src/types/internal/JsonRecord";
import { SCOPE_FIELDS } from "src/utils/constants/scope";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readText } from "src/utils/readText";

/** The manifest speaks for exactly the scope asked, in every field; one that differs is refused whole. */
export const readScope = (record: JsonRecord, scope: ReleaseScope): void => {
  const mismatch = Object.values(SCOPE_FIELDS).find(
    (key) => readText(readField(record, key), key) !== scope[key],
  );

  if (mismatch === undefined) {
    return;
  }

  throw invalidManifest(`The manifest ${mismatch} is not the scope's.`);
};
