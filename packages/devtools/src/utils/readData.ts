/** The value of an own data property, or `undefined`: no getter, and no proxy `get` trap, runs. */
export const readData = (holder: object, key: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(holder, key);

  if (descriptor === undefined || !("value" in descriptor)) {
    return undefined;
  }

  return descriptor.value;
};
