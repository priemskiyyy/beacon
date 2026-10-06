/**
 * What the store metadata says about a release beyond its version: when the
 * current version was released, in epoch milliseconds. It is advisory
 * marketing-release information, never a native build identity.
 *
 * @example
 * ```ts
 * const metadata: AppStoreMetadata = { releasedAt: Date.parse("2026-09-02T09:15:00Z") };
 * ```
 */
export type AppStoreMetadata = { releasedAt: number };
