import { invalidManifest } from "src/utils/invalidManifest";

/** A safe, non-negative integer, which no number size rounds, or a refusal naming the field. */
export const readInteger = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidManifest(`${field} must be a safe non-negative integer.`);
  }

  return value;
};
