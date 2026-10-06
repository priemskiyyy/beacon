/** What a persisted object holds under `key`, or `undefined` for a value that is not an object or has no such key of its own: an inherited key says nothing about a record. */
export const readField = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return Object.getOwnPropertyDescriptor(value, key)?.value;
};
