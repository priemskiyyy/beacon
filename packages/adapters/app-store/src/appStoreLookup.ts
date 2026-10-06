import { createReleaseSource } from "@priemskiyyy/beacon";
import type { ReleaseSource } from "@priemskiyyy/beacon";

import type { AppStoreDocument } from "src/types/AppStoreDocument";
import type { AppStoreLookupOptions } from "src/types/AppStoreLookupOptions";
import { assertAppId } from "src/utils/assertAppId";
import { assertCountry } from "src/utils/assertCountry";
import { createLookupUrl } from "src/utils/createLookupUrl";
import { readLookupEntry } from "src/utils/readLookupEntry";

/**
 * App Store metadata as an advisory release source, over Apple's published
 * lookup shape. The application's client makes the request and validates the
 * response; this source checks that the entry is the configured app and bundle
 * and reads its marketing version and release date. No entry is `none` in that
 * storefront only, and a marketing version is never presented as the exact
 * native build a device will receive. It carries no expiry: each check asks
 * again.
 *
 * @example
 * ```ts
 * const store = appStoreLookup({ appId: "284882215", country: "de", request });
 * const binary = store.select((document) => document.decision);
 * ```
 */
export const appStoreLookup = ({
  appId,
  country,
  bundleId,
  name = "app-store-lookup",
  request,
}: AppStoreLookupOptions): ReleaseSource<AppStoreDocument> => {
  assertAppId(appId);
  assertCountry(country);

  return createReleaseSource<AppStoreDocument>({
    name,
    read: async ({ signal }) => {
      const response = await request({
        url: createLookupUrl(appId, country),
        signal,
      });

      const document = readLookupEntry(response, { appId, bundleId });

      return { document, issuer: "app-store" };
    },
  });
};
