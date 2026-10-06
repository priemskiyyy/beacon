import { boundText } from "src/utils/boundText";
import {
  INSPECTION,
  REDACTED,
  SECRET_KEY,
  TRUNCATED,
} from "src/utils/constants/redaction";

const isPlain = (value: object) => {
  const prototype = Object.getPrototypeOf(value);

  return prototype === null || prototype === Object.prototype;
};

// Only the class name, read from a data property, so nothing of the object runs.
const describeClass = (value: object) => {
  const owner = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(value),
    "constructor",
  )?.value;

  if (typeof owner !== "function") {
    return "[object]";
  }

  if (typeof owner.name !== "string" || owner.name === "") {
    return "[object]";
  }

  return `[${boundText(owner.name, 60)}]`;
};

/**
 * Copies a value into plain, bounded data for display. It reads own property
 * descriptors, so no getter, `toJSON` or proxy trap of the value runs, and it
 * descends only into plain objects and arrays: anything else is named by its
 * class and left alone, so a `window` or a provider handle is never walked.
 * A property named like a secret is replaced always, at any depth.
 */
export const inspectValue = (value: unknown): unknown => {
  const seen = new WeakSet<object>();
  const budget = { remaining: INSPECTION.nodes };

  const readEntry = (holder: object, key: string, depth: number): unknown => {
    if (SECRET_KEY.test(key)) {
      return REDACTED;
    }

    const descriptor = Object.getOwnPropertyDescriptor(holder, key);

    if (descriptor === undefined || !("value" in descriptor)) {
      return "[Accessor]";
    }

    return inspect(descriptor.value, depth + 1);
  };

  const inspectList = (list: unknown[], depth: number) => {
    const items: unknown[] = [];
    const length = Math.min(list.length, INSPECTION.entries);

    for (let index = 0; index < length; index += 1) {
      if (budget.remaining < 0) {
        items.push(TRUNCATED);

        return items;
      }

      items.push(readEntry(list, String(index), depth));
    }

    if (list.length > length) {
      items.push(TRUNCATED);
    }

    return items;
  };

  const inspectRecord = (record: object, depth: number) => {
    const keys = Object.keys(record);
    const copy: Record<string, unknown> = Object.create(null);

    for (const key of keys.slice(0, INSPECTION.entries)) {
      if (budget.remaining < 0) {
        copy["…"] = TRUNCATED;

        return copy;
      }

      copy[key] = readEntry(record, key, depth);
    }

    if (keys.length > INSPECTION.entries) {
      copy["…"] = TRUNCATED;
    }

    return copy;
  };

  const inspect = (current: unknown, depth: number): unknown => {
    budget.remaining -= 1;

    if (budget.remaining < 0 || depth > INSPECTION.depth) {
      return TRUNCATED;
    }

    if (typeof current === "string") {
      return boundText(current, INSPECTION.text);
    }

    if (typeof current === "bigint") {
      return `${current}n`;
    }

    if (typeof current === "function" || typeof current === "symbol") {
      return `[${typeof current}]`;
    }

    if (current === undefined) {
      return "[undefined]";
    }

    if (typeof current === "number" && !Number.isFinite(current)) {
      return String(current);
    }

    if (typeof current !== "object" || current === null) {
      return current;
    }

    if (seen.has(current)) {
      return "[Circular or repeated reference]";
    }

    seen.add(current);

    if (Array.isArray(current)) {
      return inspectList(current, depth);
    }

    if (!isPlain(current)) {
      return describeClass(current);
    }

    return inspectRecord(current, depth);
  };

  try {
    return inspect(value, 0);
  } catch {
    return "[Unable to inspect this value]";
  }
};
