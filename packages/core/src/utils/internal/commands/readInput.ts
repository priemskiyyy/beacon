import type { CommandInput } from "src/types/internal/CommandInput";

/** What a call carries, as an object: a call made with nothing, or with a value that is no object, as untyped code can, carries no arguments. */
export const readInput = (given: CommandInput | null | undefined) => {
  if (typeof given !== "object" || given === null) {
    return {};
  }

  return given;
};
