import type { Release } from "@priemskiyyy/beacon";

import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { ManifestMetadata } from "src/types/ManifestMetadata";
import { readCompatibility } from "src/utils/readCompatibility";
import { readField } from "src/utils/readField";
import { readIdentity } from "src/utils/readIdentity";
import { readMetadata } from "src/utils/readMetadata";
import { readOptional } from "src/utils/readOptional";
import { readText } from "src/utils/readText";

/** The release an object describes: its identity, and its label, compatibility and metadata when it has them. */
export const readRelease = (
  record: JsonRecord,
  field: string,
): Release<ManifestMetadata> => {
  const label = readOptional(readField(record, "label"), (value) =>
    readText(value, `${field}.label`),
  );

  const compatibility = readOptional(
    readField(record, "compatibility"),
    (value) => readCompatibility(value, `${field}.compatibility`),
  );

  const metadata = readOptional(readField(record, "metadata"), (value) =>
    readMetadata(value, `${field}.metadata`),
  );

  return {
    identity: readIdentity(readField(record, "identity"), `${field}.identity`),
    ...(label === undefined ? {} : { label }),
    ...(compatibility === undefined ? {} : { compatibility }),
    ...(metadata === undefined ? {} : { metadata }),
  };
};
