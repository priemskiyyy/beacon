/**
 * Options for `webBuild()`. `authority` is who assigns the build ids, which is
 * `scope.application` unless you give another, and `domain` is what they name,
 * `web-artifact` by default, the word the standard manifest uses: the
 * manifest's release must use the same two, or the route says `inconclusive`.
 * `id` is the constant the bundler writes into the code, such as
 * `import.meta.env.VITE_BUILD_ID` or `process.env.NEXT_PUBLIC_BUILD_ID`. It
 * may be `undefined`, null or empty, which is what a constant nobody defined
 * compiles to, and the build is then unknown. `label` is a name for people and is the id by default. An authority
 * or a domain that is given and is empty or has a space around it is refused
 * with `INVALID_CONFIGURATION`.
 *
 * @example
 * ```ts
 * const options: WebBuildOptions = {
 *   id: "a91b44e",
 *   label: "September release",
 * };
 * ```
 */
export type WebBuildOptions = {
  authority?: string;
  id: string | null | undefined;
  label?: string | null | undefined;
  domain?: string;
};
