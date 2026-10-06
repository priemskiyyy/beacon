import { boundText } from "src/utils/boundText";
import { readData } from "src/utils/readData";

/** Only the class name of an object, in brackets, so nothing of the object runs. */
export const describeClass = (value: object) => {
  const constructor = readData(Object.getPrototypeOf(value), "constructor");

  const name =
    typeof constructor === "function" ? readData(constructor, "name") : null;

  if (typeof name !== "string" || name === "") {
    return "[object]";
  }

  return `[${boundText(name, 60)}]`;
};
