import {
  CANONICAL_DECIMAL_PATTERN,
  MAX_INTEGER_DIGITS,
} from "src/utils/constants/versions";
import { createInvalidVersionError } from "src/utils/internal/versions/createInvalidVersionError";
import { createVersionTypeError } from "src/utils/internal/versions/createVersionTypeError";

/** Accepts a safe non-negative integer or a canonical decimal string, and answers the canonical string. */
export const parseInteger = (input: number | string): string => {
  if (typeof input === "number") {
    if (!Number.isSafeInteger(input) || input < 0) {
      throw createInvalidVersionError("integer", String(input));
    }

    return String(input);
  }

  // A manifest, a store or a bridge hands over whatever it holds, whatever the type says.
  if (typeof input !== "string") {
    throw createVersionTypeError("integer", "a number or a text");
  }

  if (input.length > MAX_INTEGER_DIGITS) {
    throw createInvalidVersionError("integer", input.slice(0, 32));
  }

  if (!CANONICAL_DECIMAL_PATTERN.test(input)) {
    throw createInvalidVersionError("integer", input);
  }

  return input;
};
