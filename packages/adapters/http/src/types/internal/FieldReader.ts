import type { JsonRecord } from "src/types/internal/JsonRecord";

/** Reads a variant of an object from its fields, naming the field for the error. */
export type FieldReader<TValue> = (record: JsonRecord, field: string) => TValue;
