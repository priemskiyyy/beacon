import type { ManifestResponse } from "src/types/ManifestResponse";

/**
 * The call `standardManifestSource` makes for one read: the global `fetch`
 * satisfies it, and so does any client that takes a URL and these options.
 * `cache` is always `no-cache`, so a browser revalidates with the server
 * before it serves its stored copy, and `headers` already holds the validator
 * of the answer the source holds, as `if-none-match`.
 *
 * @example
 * ```ts
 * const send: ManifestFetch = fetch;
 * ```
 */
export type ManifestFetch = (
  url: string,
  init: {
    signal: AbortSignal;
    headers: Record<string, string>;
    cache: "no-cache";
  },
) => Promise<ManifestResponse>;
