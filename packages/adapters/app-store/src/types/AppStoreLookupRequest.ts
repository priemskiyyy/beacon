/**
 * What one lookup hands the application's client: the documented lookup URL
 * for the configured app and storefront, and the signal that aborts once
 * nobody waits for the answer.
 *
 * @example
 * ```ts
 * const request = ({ url, signal }: AppStoreLookupRequest) => lookup(url, { signal });
 * ```
 */
export type AppStoreLookupRequest = {
  url: string;
  signal: AbortSignal;
};
