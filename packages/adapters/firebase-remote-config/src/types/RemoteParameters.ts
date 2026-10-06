/**
 * What `document` reads the activated parameters through. `remote(key)` is the
 * text the server sent for the key, and it throws, which fails the read, when
 * the key is a default of the application or is nowhere. `source(key)` says
 * where the key's value comes from, for a document that accepts a default
 * knowingly. Read them inside `document`: they are the activated values of
 * that one read.
 *
 * @example
 * ```ts
 * const document = ({ remote, source }: RemoteParameters) => ({
 *   minimumBuild: remote("minimum_build"),
 *   hasNotes: source("release_notes") === "remote",
 * });
 * ```
 */
export type RemoteParameters = {
  remote(key: string): string;
  source(key: string): "remote" | "default" | "missing";
};
