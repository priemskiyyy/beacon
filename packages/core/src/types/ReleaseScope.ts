/**
 * The context a release authority speaks about: one application in one
 * environment, on one platform, through one distribution channel. Every
 * source read, cache and journal record belongs to exactly one scope. When
 * the answers differ by account, `partition` names the account as opaque
 * text, so no source keeps, renews or compares one account's answer for
 * another; put no token in it.
 *
 * @example
 * ```ts
 * const scope: ReleaseScope = {
 *   application: "com.example.notes",
 *   environment: "production",
 *   platform: "web",
 *   distribution: "public-web",
 *   partition: "user-42",
 * };
 * ```
 */
export type ReleaseScope = {
  application: string;
  environment: string;
  platform: string;
  distribution: string;
  partition?: string;
};
