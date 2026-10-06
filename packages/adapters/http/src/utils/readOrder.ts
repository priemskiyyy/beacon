import type { OrderKind } from "src/types/OrderKind";
import type { OrderValues } from "src/types/OrderValues";
import { invalidManifest } from "src/utils/invalidManifest";
import { readText } from "src/utils/readText";

// A safe, non-negative integer, which no number size rounds.
const readInteger = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidManifest(`${field} must be a safe non-negative integer.`);
  }

  return value;
};

// One reader for each kind, so a route reads the order its version strategy takes.
const READERS: {
  [TKind in OrderKind]: (value: unknown, field: string) => OrderValues[TKind];
} = {
  text: readText,
  integer: readInteger,
};

/** The order of a candidate, written the way its route declared. */
export const readOrder = <TKind extends OrderKind>(
  kind: TKind,
  value: unknown,
  field: string,
): OrderValues[TKind] => READERS[kind](value, field);
