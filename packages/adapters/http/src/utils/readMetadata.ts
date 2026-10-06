import type { ManifestMetadata } from "src/types/ManifestMetadata";
import {
  MAXIMUM_METADATA_ENTRIES,
  UNSAFE_KEYS,
} from "src/utils/constants/limits";
import { invalidManifest } from "src/utils/invalidManifest";
import { readRecord } from "src/utils/readRecord";
import { readText } from "src/utils/readText";

/** A few short strings under safe keys; a key that could corrupt a registry is refused. */
export const readMetadata = (
  value: unknown,
  field: string,
): ManifestMetadata => {
  const entries = Object.entries(readRecord(value, field));

  if (entries.length > MAXIMUM_METADATA_ENTRIES) {
    throw invalidManifest(
      `${field} must have at most ${MAXIMUM_METADATA_ENTRIES} entries.`,
    );
  }

  return Object.fromEntries(
    entries.map(([key, entry]) => {
      if (UNSAFE_KEYS.includes(key)) {
        throw invalidManifest(`${field} must not have the key ${key}.`);
      }

      return [key, readText(entry, `${field}.${key}`)];
    }),
  );
};
