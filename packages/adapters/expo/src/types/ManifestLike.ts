/**
 * The part of an update manifest the adapter reads: its id, which the update
 * server assigns. The real `Manifest` satisfies it.
 *
 * @example
 * ```ts
 * const manifest: ManifestLike = { id: "8b2d5c1e-0a3f-4c8e-9d1b-6e7f2a4c5b90" };
 * ```
 */
export type ManifestLike = { id: string };
