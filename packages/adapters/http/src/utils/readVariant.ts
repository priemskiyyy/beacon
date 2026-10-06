import type { VariantReader } from "src/types/internal/VariantReader";
import { readField } from "src/utils/readField";
import { invalidManifest } from "src/utils/invalidManifest";
import { readRecord } from "src/utils/readRecord";
import { readText } from "src/utils/readText";

type ReadVariantOptions<TValue> = {
  value: unknown;
  field: string;
  /** The field that names the variant. */
  tag: "kind" | "status";
  readers: Record<string, VariantReader<TValue>>;
};

/** The variant an object names, read by its own reader; a name no reader has is refused. */
export const readVariant = <TValue>({
  value,
  field,
  tag,
  readers,
}: ReadVariantOptions<TValue>): TValue => {
  const record = readRecord(value, field);
  const name = readText(readField(record, tag), `${field}.${tag}`);
  const reader = new Map(Object.entries(readers)).get(name);

  if (reader === undefined) {
    throw invalidManifest(
      `${field}.${tag} must be one of ${Object.keys(readers).join(", ")}.`,
    );
  }

  return reader(record, field);
};
