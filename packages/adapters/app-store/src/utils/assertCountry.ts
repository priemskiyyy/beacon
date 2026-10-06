import { BeaconError } from "@priemskiyyy/beacon";

import { INVALID_COUNTRY } from "src/utils/constants/messages";

/** Refuses a storefront that is not a two-letter country code, before it is put into a URL. */
export const assertCountry = (country: string) => {
  if (/^[a-z]{2}$/.test(country)) {
    return;
  }

  throw new BeaconError({
    code: "INVALID_CONFIGURATION",
    message: INVALID_COUNTRY,
  });
};
