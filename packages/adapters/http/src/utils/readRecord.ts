import type { JsonRecord } from "src/types/internal/JsonRecord";
import { invalidManifest } from "src/utils/invalidManifest";

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The object a value is, or a refusal naming the field. */
export const readRecord = (value: unknown, field: string): JsonRecord => {
  if (!isRecord(value)) {
    throw invalidManifest(`${field} must be an object.`);
  }

  return value;
};
