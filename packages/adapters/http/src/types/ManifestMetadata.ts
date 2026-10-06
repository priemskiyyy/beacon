/**
 * The application data a manifest may attach to a release: a few short
 * strings, such as the key of the release notes. It is data, never
 * configuration.
 *
 * @example
 * ```ts
 * const metadata: ManifestMetadata = { releaseNotesKey: "recovery-208" };
 * ```
 */
export type ManifestMetadata = Record<string, string>;
