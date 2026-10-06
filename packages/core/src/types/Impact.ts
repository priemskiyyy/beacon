/**
 * What a command can do to the running application. They are semantic
 * contracts, not labels: a participant chooses which ones it must settle for.
 *
 * - `document-replacement`: the current document is replaced by a navigation.
 * - `javascript-restart`: the JavaScript runtime restarts.
 * - `native-update-flow`: a provider's own update UI or install takes over.
 * - `worker-takeover`: a service worker starts controlling clients.
 * - `external-handoff`: the user leaves for a store or another application.
 * - `may-activate-on-next-start`: preparing may make the provider select the
 *   result on a later start, whether or not Beacon asks for it.
 *
 * @example
 * ```ts
 * const impacts: Impact[] = ["document-replacement", "javascript-restart"];
 * ```
 */
export type Impact =
  | "document-replacement"
  | "javascript-restart"
  | "native-update-flow"
  | "worker-takeover"
  | "external-handoff"
  | "may-activate-on-next-start";
