/**
 * Options for `webRelease()`. `authority` is who assigns the build ids, which
 * is `scope.application`, the authority `webBuild` names the running build
 * under: the release is comparable with it only under the same one. It is
 * required here because a `select` is given the document and not the scope, so
 * pass the same text you gave the scope. `id` is the
 * build the source says should run, such as a field of a version file, and
 * `label` is a name for people. An authority that is empty or has a space
 * around it, and an id that is empty, padded or the text a missing define
 * compiles to, is refused with `INVALID_CONFIGURATION`.
 *
 * @example
 * ```ts
 * const options: WebReleaseOptions = {
 *   authority: "com.example.notes",
 *   id: "a91b44e",
 *   label: "September release",
 * };
 * ```
 */
export type WebReleaseOptions = {
  authority: string;
  id: string;
  label?: string | null | undefined;
};
