/** A field that may be absent: absent is `undefined`, and anything present must read. */
export const readOptional = <TValue>(
  value: unknown,
  read: (value: unknown) => TValue,
): TValue | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return read(value);
};
