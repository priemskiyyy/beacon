const isPlainObject = (value: object) => {
  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

// Structural equality for the plain data a route publishes, so an event that
// changes nothing keeps its snapshot. Dates, maps and class instances are not
// data here: two different ones are never the same.
export const isSameData = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (typeof left !== "object" || typeof right !== "object") {
    return false;
  }

  if (left === null || right === null) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    return (
      left.length === right.length &&
      left.every((item, index) => isSameData(item, right[index]))
    );
  }

  if (!isPlainObject(left) || !isPlainObject(right)) {
    return false;
  }

  const leftEntries = Object.entries(left);
  const rightEntries = new Map<string, unknown>(Object.entries(right));

  if (leftEntries.length !== rightEntries.size) {
    return false;
  }

  return leftEntries.every(
    ([key, value]) =>
      rightEntries.has(key) && isSameData(value, rightEntries.get(key)),
  );
};
