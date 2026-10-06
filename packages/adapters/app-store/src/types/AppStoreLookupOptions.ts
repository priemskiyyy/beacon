import type { AppStoreLookupRequest } from "src/types/AppStoreLookupRequest";
import type { AppStoreLookupResponse } from "src/types/AppStoreLookupResponse";

/**
 * Options for `appStoreLookup()`. `appId` and `country` are the application's
 * own configuration: the storefront is never derived from the device, since a
 * device's physical country does not establish its account storefront.
 * `bundleId`, when given, must match the entry's. `request` is the
 * application's client call, which owns the transport and validates the
 * response.
 *
 * @example
 * ```ts
 * appStoreLookup({
 *   appId: "284882215",
 *   country: "de",
 *   bundleId: "com.example.notes",
 *   request: async ({ url, signal }) => parseLookup(await (await fetch(url, { signal })).json()),
 * });
 * ```
 */
export type AppStoreLookupOptions = {
  appId: string;
  country: string;
  bundleId?: string;
  name?: string;
  request: (
    request: AppStoreLookupRequest,
  ) => AppStoreLookupResponse | Promise<AppStoreLookupResponse>;
};
