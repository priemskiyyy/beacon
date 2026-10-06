import type { JsonRecord } from "src/types/internal/JsonRecord";

/** An own field of a record; a name the prototype chain happens to have is not a field. */
export const readField = (record: JsonRecord, key: string): unknown =>
  Object.getOwnPropertyDescriptor(record, key)?.value;
