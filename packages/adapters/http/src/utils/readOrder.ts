import type { OrderKind } from "src/types/OrderKind";
import type { OrderValues } from "src/types/OrderValues";
import { readInteger } from "src/utils/readInteger";
import { readText } from "src/utils/readText";

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
