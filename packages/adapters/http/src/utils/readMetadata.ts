import type { ManifestMetadata } from "src/types/ManifestMetadata";
import {
  MAXIMUM_METADATA_ENTRIES,
  UNSAFE_KEYS,
} from "src/utils/constants/limits";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readRecord } from "src/utils/readRecord";
import { readText } from "src/utils/readText";

/** A few short strings under safe keys; a key that could corrupt a registry is refused. */
export const readMetadata = (
  value: unknown,
  field: string,
): ManifestMetadata => {
  const record = readRecord(value, field);

  // Sorted, so the same metadata written in another order is the same document.
  const keys = Object.keys(record).sort();

  if (keys.length > MAXIMUM_METADATA_ENTRIES) {
    throw invalidManifest(
      `${field} must have at most ${MAXIMUM_METADATA_ENTRIES} entries.`,
    );
  }

  return Object.fromEntries(
    keys.map((key) => {
      if (UNSAFE_KEYS.includes(key)) {
        throw invalidManifest(`${field} must not have the key ${key}.`);
      }

      readText(key, `A key of ${field}`);

      return [key, readText(readField(record, key), `${field}.${key}`)];
    }),
  );
};
