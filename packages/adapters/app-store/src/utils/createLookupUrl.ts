import { LOOKUP_URL } from "src/utils/constants/lookup";

/** The documented lookup URL for one app in one storefront. */
export const createLookupUrl = (appId: string, country: string) =>
  `${LOOKUP_URL}?id=${appId}&country=${country}`;
