/**
 * What one lookup hands the application's client: the documented lookup URL
 * for the configured app and storefront, and the signal that aborts once
 * nobody waits for the answer.
 *
 * @example
 * ```ts
 * const lookUp = ({ url, signal }: AppStoreFetchContext) => fetch(url, { signal });
 * ```
 */
export type AppStoreFetchContext = {
  url: string;
  signal: AbortSignal;
};
