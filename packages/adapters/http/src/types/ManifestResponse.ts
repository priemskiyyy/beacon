/**
 * The part of a `Response` that reading a manifest needs, so any `fetch`
 * satisfies it, React Native's included, and a test fakes it with a plain
 * object.
 *
 * @example
 * ```ts
 * const response: ManifestResponse = await fetch("/releases.json", { signal });
 * ```
 */
export type ManifestResponse = {
  status: number;
  /** Absent where the runtime cannot say, as in React Native: a redirect is then not refused, unless a wrapper around `fetch` sets it from `response.url`. */
  redirected?: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};
