import { newerRoute } from "@priemskiyyy/beacon";

import { appleMarketingVersion } from "src/appleMarketingVersion";
import { appleVersion } from "src/appleVersion";
import { appStoreHandoff } from "src/appStoreHandoff";
import { appStoreLookup } from "src/appStoreLookup";
import type { AppStoreOptions } from "src/types/AppStoreOptions";
import { fetchLookup } from "src/utils/fetchLookup";

/**
 * The App Store as one route: the lookup source, the order of marketing
 * versions and the handoff that opens the store page, composed the way
 * `appStoreLookup`, `appleVersion` and `appStoreHandoff` are by hand. It offers
 * a marketing version newer than the one that runs, which the `native` running
 * fact supplies as `shortVersion`, and `openStore` opens the page of the app,
 * with the offer or without one. Both speak for the `app-store` distribution
 * only: in a scope that says another, there is no offer and `openStore` is
 * unsupported with the reason `other-distribution`. Nothing here installs
 * anything, and a marketing version is never the exact build a device gets.
 * Without a `fetch` of your own it asks Apple's lookup through the global
 * `fetch`, which React Native has; its response cannot say it was redirected
 * there, so a redirect is not refused.
 *
 * @example
 * ```ts
 * const routes = {
 *   store: appStore({ appId: "284882215", country: "de", linking: Linking }),
 * };
 * ```
 */
export const appStore = ({
  appId,
  country,
  bundleId,
  linking,
  fetch: lookUp = fetchLookup,
}: AppStoreOptions) => {
  const lookup = appStoreLookup({
    appId,
    country,
    ...(bundleId === undefined ? {} : { bundleId }),
    fetch: lookUp,
  });

  return newerRoute({
    source: lookup.select((document) => document.decision),
    version: appleVersion(),
    current: appleMarketingVersion,
    mechanism: appStoreHandoff({ appId, linking }),
  });
};
