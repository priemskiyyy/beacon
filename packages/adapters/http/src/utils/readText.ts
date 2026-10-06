import { MAXIMUM_TEXT_LENGTH } from "src/utils/constants/limits";
import { invalidManifest } from "src/utils/invalidManifest";

/** A non-empty, bounded text, or a refusal naming the field. */
export const readText = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw invalidManifest(`${field} must be a text.`);
  }

  if (value.length === 0 || value.length > MAXIMUM_TEXT_LENGTH) {
    throw invalidManifest(
      `${field} must have 1 to ${MAXIMUM_TEXT_LENGTH} characters.`,
    );
  }

  return value;
};
