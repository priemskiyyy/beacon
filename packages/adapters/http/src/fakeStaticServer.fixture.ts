import { fakeResponse } from "src/standardManifest.fixture";
import type { ManifestFetch } from "src/types/ManifestFetch";

// What a static host serves for one web route: the decision and nothing else, with no times, no scope and no revision.
export const STATIC_MANIFEST = JSON.stringify({
  schemaVersion: 1,
  routes: { web: { kind: "target", release: { identity: "a91b44e" } } },
});

type Request = { url: string; init: Parameters<ManifestFetch>[1] };

// A static host with an ETag: a request that sends the validator it handed out gets a 304, and any other gets the manifest.
export const fakeStaticServer = (etag = '"a91b44e"') => {
  const requests: Request[] = [];

  const fetch: ManifestFetch = async (url, init) => {
    requests.push({ url, init });

    if (init.headers["if-none-match"] === etag) {
      return fakeResponse({ status: 304 });
    }

    return fakeResponse({ text: STATIC_MANIFEST, etag });
  };

  return { fetch, requests, reads: () => requests.length };
};
