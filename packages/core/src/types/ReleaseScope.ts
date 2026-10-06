/**
 * The context a release authority speaks about: one application in one
 * environment, on one platform, through one distribution channel. Every
 * source read, cache and journal record belongs to exactly one scope.
 *
 * @example
 * ```ts
 * const scope: ReleaseScope = {
 *   application: "com.example.notes",
 *   environment: "production",
 *   platform: "web",
 *   distribution: "public-web",
 * };
 * ```
 */
export type ReleaseScope = {
  application: string;
  environment: string;
  platform: string;
  distribution: string;
};
