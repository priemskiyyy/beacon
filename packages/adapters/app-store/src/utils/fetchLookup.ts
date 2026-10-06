import { BeaconError } from "@priemskiyyy/beacon";

import type { AppStoreFetchContext } from "src/types/AppStoreFetchContext";
import type { AppStoreLookupResponse } from "src/types/AppStoreLookupResponse";
import { readLookupResponse } from "src/utils/readLookupResponse";

/**
 * The lookup client `appStore` uses when the application gives none: the
 * global `fetch` of the URL, a failing status refused, and the JSON read into
 * the entries the source checks. Apple's lookup has one fixed shape, unlike a
 * manifest, so the application's own client has nothing to add. A response
 * that says it was redirected is refused where it can say so, which React
 * Native's own `fetch` cannot. What `fetch` throws, and a body that is not
 * JSON, fail the read as they were thrown.
 */
export const fetchLookup = async (
  context: AppStoreFetchContext,
): Promise<AppStoreLookupResponse> => {
  const response = await fetch(context.url, { signal: context.signal });

  if (response.redirected === true) {
    throw new BeaconError({
      code: "SOURCE_FAILED",
      message: "The App Store lookup redirected, which this reader refuses.",
    });
  }

  if (!response.ok) {
    throw new BeaconError({
      code: "SOURCE_FAILED",
      message: `The App Store lookup answered ${response.status}.`,
    });
  }

  return readLookupResponse(await response.json());
};
