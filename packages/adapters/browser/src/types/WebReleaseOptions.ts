/**
 * Options for `webRelease()`. `authority` is who assigns the build ids, which
 * is `scope.application`, the same authority `webBuild` is given: the release
 * is comparable with the running build only under the same one. `id` is the
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
