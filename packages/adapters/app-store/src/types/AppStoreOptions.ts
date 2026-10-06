import type { AppStoreLookupOptions } from "src/types/AppStoreLookupOptions";
import type { LinkingLike } from "src/types/LinkingLike";

/**
 * Options for `appStore()`. `appId` and `country` are the application's own
 * configuration, as for the lookup source, and `bundleId`, when given, must
 * match the entry's. `linking` is the platform's link opener, such as React
 * Native's `Linking`. `fetch` is your own lookup client, and is only for an
 * application that needs one: without it the route asks Apple's lookup through
 * the global `fetch`.
 *
 * @example
 * ```ts
 * appStore({
 *   appId: "284882215",
 *   country: "de",
 *   bundleId: "com.example.notes",
 *   linking: Linking,
 * });
 * ```
 */
export type AppStoreOptions = {
  appId: string;
  country: string;
  bundleId?: string;
  linking: LinkingLike;
  fetch?: AppStoreLookupOptions["fetch"];
};
