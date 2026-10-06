import { BeaconError } from "@priemskiyyy/beacon";

import type { AppleVersion } from "src/types/AppleVersion";

const GRAMMAR = /^(\d{1,9})(?:\.(\d{1,9}))?(?:\.(\d{1,9}))?$/;

/** A marketing version of one to three numbers, the way `CFBundleShortVersionString` allows; anything else breaks the grammar. */
export const parseAppleVersion = (input: string): AppleVersion => {
  const match = GRAMMAR.exec(input);

  if (match === null) {
    throw new BeaconError({
      code: "INVALID_VERSION",
      message: `The value "${input}" is not a valid Apple marketing version.`,
    });
  }

  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
};
