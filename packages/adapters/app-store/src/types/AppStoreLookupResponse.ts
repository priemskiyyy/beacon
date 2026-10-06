import type { AppStoreLookupEntry } from "src/types/AppStoreLookupEntry";

/**
 * What the application's client resolves for one lookup, already validated by
 * the client: the entries the lookup answered. A response that is not this
 * shape, such as an HTML page, a rate limit or a blocked request, is the
 * client's failure to throw, not something to guess at here.
 *
 * @example
 * ```ts
 * const response: AppStoreLookupResponse = { results: [] };
 * ```
 */
export type AppStoreLookupResponse = { results: AppStoreLookupEntry[] };
