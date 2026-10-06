/**
 * One result of Apple's lookup API, with the fields the adapter reads. The
 * lookup returns many more; a field it does not read is not declared here.
 *
 * @example
 * ```ts
 * const entry: AppStoreLookupEntry = {
 *   trackId: 284882215,
 *   bundleId: "com.example.notes",
 *   version: "3.2.1",
 *   currentVersionReleaseDate: "2026-09-02T09:15:00Z",
 * };
 * ```
 */
export type AppStoreLookupEntry = {
  trackId: number;
  bundleId: string;
  version: string;
  currentVersionReleaseDate: string;
};
