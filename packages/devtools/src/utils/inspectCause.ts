import { describeClass } from "src/utils/describeClass";
import { inspectValue } from "src/utils/inspectValue";
import { readData } from "src/utils/readData";

/** How many errors of a chain of causes are named before the rest is cut. */
const CHAIN = 4;

// An error is its class, its message and its own fields, and what caused it; nothing of it runs, since only own data is read.
const describeError = (error: Error, depth: number): unknown => {
  const description: Record<string, unknown> = Object.create(null);

  description["error"] = describeClass(error);
  description["message"] = readData(error, "message");

  for (const key of Object.keys(error)) {
    description[key] = readData(error, key);
  }

  const cause = readData(error, "cause");

  if (cause !== undefined) {
    description["cause"] = describe(cause, depth + 1);
  }

  return description;
};

const describe = (value: unknown, depth: number): unknown => {
  if (!(value instanceof Error) || depth >= CHAIN) {
    return value;
  }

  return describeError(value, depth);
};

/**
 * What a failure threw, as plain bounded data for the panel. An error is named
 * by its class and carries its message, its own fields and its cause, down a
 * short chain; anything else is inspected as any value is. A property named
 * like a secret is replaced at any depth.
 */
export const inspectCause = (cause: unknown) =>
  inspectValue(describe(cause, 0));
