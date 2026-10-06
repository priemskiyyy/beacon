import { BeaconError } from "@priemskiyyy/beacon";

/** Refuses an authority or a domain that is empty or has a space around it, before a build is named under it. */
export const assertIdentityText = (name: string, text: string) => {
  if (text !== "" && text === text.trim()) {
    return;
  }

  throw new BeaconError({
    code: "INVALID_CONFIGURATION",
    message: `The ${name} of a web build is text with no space around it.`,
  });
};
