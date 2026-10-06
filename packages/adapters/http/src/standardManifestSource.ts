import { BeaconError } from "@priemskiyyy/beacon";
import type { ReleaseSource } from "@priemskiyyy/beacon";

import { http } from "src/http";
import { readStandardManifest } from "src/readStandardManifest";
import type { ManifestFetch } from "src/types/ManifestFetch";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardManifest } from "src/types/StandardManifest";
import type { StandardManifestSourceOptions } from "src/types/StandardManifestSourceOptions";

// A host without `fetch`, such as a test run or an old server, says what to pass instead of failing on a missing name.
const readGlobalFetch = (): ManifestFetch => {
  if (typeof fetch === "undefined") {
    throw new BeaconError({
      code: "SOURCE_FAILED",
      message:
        "There is no global fetch here: pass one as the fetch option of standardManifestSource.",
    });
  }

  return fetch;
};

/**
 * A manifest served at a URL as a release source: the request, the validator,
 * the scope and the time are this source's, and what is read is a standard
 * manifest for the routes you declare. It asks the global `fetch` for `url`
 * with `cache: "no-cache"`, so a browser revalidates with the server instead
 * of serving its stored copy, sends the `ETag` of the answer it holds back as
 * `If-None-Match`, reads the time from the Beacon's clock, and refuses
 * everything that is not a valid manifest for the scope, a redirect included.
 * A manifest a static host serves needs only `schemaVersion` and `routes`:
 * without an `expiresAt` of its own its evidence holds for the client's
 * window, and every read that the server confirms starts the window again.
 * `fetch` is the door for your own client, and `http` for a manifest that is
 * not the standard one.
 *
 * @example
 * ```ts
 * const manifest = standardManifestSource({
 *   url: "/releases.json",
 *   routes: { web: { kind: "target" } },
 * });
 * const web = manifest.select((document) => document.routes.web);
 * ```
 */
export const standardManifestSource = <TDeclarations extends RouteDeclarations>(
  options: StandardManifestSourceOptions<TDeclarations>,
): ReleaseSource<StandardManifest<TDeclarations>> => {
  const { url, routes, headers = {}, name = "manifest", limits } = options;

  return http({
    name,
    fetch: async (context) => {
      const { scope, signal, clock, validator } = context;
      // Called as a plain function: a browser's `fetch` refuses any other `this`.
      const send = options.fetch ?? readGlobalFetch();

      const response = await send(url, {
        signal,
        cache: "no-cache",
        headers:
          validator === null
            ? headers
            : { ...headers, "if-none-match": validator },
      });

      return readStandardManifest({
        response,
        scope,
        routes,
        now: clock.now(),
        ...(limits === undefined ? {} : { limits }),
      });
    },
  });
};
