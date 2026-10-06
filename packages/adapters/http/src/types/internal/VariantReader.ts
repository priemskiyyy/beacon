import type { JsonRecord } from "src/types/internal/JsonRecord";

/** Reads the object of one variant, whose tag was already read; `field` is the path that names it in a refusal. */
export type VariantReader<TValue> = (
  record: JsonRecord,
  field: string,
) => TValue;
