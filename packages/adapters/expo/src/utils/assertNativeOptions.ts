import { BeaconError } from "@priemskiyyy/beacon";

import type { NativeReaderOptions } from "src/types/internal/NativeReaderOptions";
import { cleanText } from "src/utils/cleanText";

const assertText = (name: string, value: string | undefined) => {
  if (value === undefined) {
    return;
  }

  if (cleanText(value) === value) {
    return;
  }

  throw new BeaconError({
    code: "INVALID_CONFIGURATION",
    message: `The ${name} of a native reader is text with no space around it.`,
  });
};

/** Refuses an authority or a domain that is empty or has a space around it, before a build is named under it. */
export const assertNativeOptions = ({
  authority,
  domain,
}: NativeReaderOptions) => {
  assertText("authority", authority);
  assertText("domain", domain);
};
