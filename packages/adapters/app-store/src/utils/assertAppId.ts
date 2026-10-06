import { BeaconError } from "@priemskiyyy/beacon";

import { INVALID_APP_ID } from "src/utils/constants/messages";

/** Refuses an App Store id that is not numeric, before it is put into a URL. */
export const assertAppId = (appId: string) => {
  if (/^\d+$/.test(appId)) {
    return;
  }

  throw new BeaconError({
    code: "INVALID_CONFIGURATION",
    message: INVALID_APP_ID,
  });
};
