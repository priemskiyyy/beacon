import { BeaconError } from "@priemskiyyy/beacon";

/** Refuses an App Store id that is not numeric, before it is put into a URL. */
export const assertAppId = (appId: string) => {
  if (/^\d+$/.test(appId)) {
    return;
  }

  throw new BeaconError({
    code: "INVALID_CONFIGURATION",
    message: "An App Store id is a string of digits.",
  });
};
