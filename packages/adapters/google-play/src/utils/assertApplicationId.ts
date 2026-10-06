import { BeaconError } from "@priemskiyyy/beacon";

/** Refuses an application id that is not the dotted name Android gives one, before it is put into a URL. */
export const assertApplicationId = (applicationId: string) => {
  if (
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(applicationId)
  ) {
    return;
  }

  throw new BeaconError({
    code: "INVALID_CONFIGURATION",
    message:
      "An application id is two or more names of letters, digits and underscores joined by dots, each starting with a letter.",
  });
};
