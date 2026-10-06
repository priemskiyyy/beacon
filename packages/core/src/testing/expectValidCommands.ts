import { expect } from "vitest";

import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import {
  COMMAND_REFERENCES,
  IMPACT_EFFECTS,
  TARGET_BINDINGS,
} from "src/utils/constants/commands";

const isKey = (keys: object, value: string) => Object.hasOwn(keys, value);

/** Every command declares a known reference, a known binding and known, distinct impacts. */
export const expectValidCommands = (
  commands: CommandMap<object, RouteBody, RouteBody>,
) => {
  for (const command of Object.values(commands)) {
    expect(isKey(COMMAND_REFERENCES, command.reference)).toBe(true);
    expect(isKey(TARGET_BINDINGS, command.binding)).toBe(true);
    expect(new Set(command.impacts).size).toBe(command.impacts.length);

    for (const impact of command.impacts) {
      expect(isKey(IMPACT_EFFECTS, impact)).toBe(true);
    }
  }
};
