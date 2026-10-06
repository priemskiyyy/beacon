import type { CommandInput } from "src/types/internal/CommandInput";
import type { CommandParameters } from "src/types/CommandParameters";
import { CONTROL_KEYS } from "src/utils/constants/commands";

/** What a call carries besides Beacon's own keys: the parameters its command declared. */
export const readParameters = (input: CommandInput): CommandParameters =>
  Object.fromEntries(
    Object.entries(input).filter(
      ([key]) => !CONTROL_KEYS.some((control) => control === key),
    ),
  );
