import type {
  Compatibility,
  Release,
  ReleaseIdentity,
} from "@priemskiyyy/beacon";

import type { VariantReader } from "src/types/internal/VariantReader";
import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { ManifestMetadata } from "src/types/ManifestMetadata";
import {
  MAXIMUM_METADATA_ENTRIES,
  UNSAFE_KEYS,
} from "src/utils/constants/limits";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readList } from "src/utils/readList";
import { readRecord } from "src/utils/readRecord";
import { readText } from "src/utils/readText";
import { readVariant } from "src/utils/readVariant";

// A record of readers makes the compiler name every variant of the core's type.
const IDENTITIES: Record<
  ReleaseIdentity["status"],
  VariantReader<ReleaseIdentity>
> = {
  known: (record, field) => ({
    status: "known",
    authority: readText(readField(record, "authority"), `${field}.authority`),
    domain: readText(readField(record, "domain"), `${field}.domain`),
    value: readText(readField(record, "value"), `${field}.value`),
  }),
  unknown: (record, field) => ({
    status: "unknown",
    reason: readText(readField(record, "reason"), `${field}.reason`),
  }),
};

const COMPATIBILITIES: Record<
  Compatibility["status"],
  VariantReader<Compatibility>
> = {
  compatible: (record, field) => ({
    status: "compatible",
    basis: readText(readField(record, "basis"), `${field}.basis`),
  }),
  incompatible: (record, field) => ({
    status: "incompatible",
    reasons: readList(
      readField(record, "reasons"),
      `${field}.reasons`,
      readText,
    ),
  }),
  delegated: (record, field) => ({
    status: "delegated",
    authority: readText(readField(record, "authority"), `${field}.authority`),
  }),
  unknown: (record, field) => ({
    status: "unknown",
    reason: readText(readField(record, "reason"), `${field}.reason`),
  }),
  "not-applicable": () => ({ status: "not-applicable" }),
};

// A few short strings under safe keys; a key that could corrupt a registry is refused.
const readMetadata = (value: unknown, field: string): ManifestMetadata => {
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

/** The release an object describes: its identity, and its label, compatibility and metadata when it has them. */
export const readRelease = (
  record: JsonRecord,
  field: string,
): Release<ManifestMetadata> => {
  const release: Release<ManifestMetadata> = {
    identity: readVariant({
      value: readField(record, "identity"),
      field: `${field}.identity`,
      tag: "status",
      readers: IDENTITIES,
    }),
  };

  const label = readField(record, "label");

  if (label !== undefined) {
    release.label = readText(label, `${field}.label`);
  }

  const compatibility = readField(record, "compatibility");

  if (compatibility !== undefined) {
    release.compatibility = readVariant({
      value: compatibility,
      field: `${field}.compatibility`,
      tag: "status",
      readers: COMPATIBILITIES,
    });
  }

  const metadata = readField(record, "metadata");

  if (metadata !== undefined) {
    release.metadata = readMetadata(metadata, `${field}.metadata`);
  }

  return release;
};
