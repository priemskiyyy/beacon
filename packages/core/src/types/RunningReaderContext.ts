import type { ReleaseScope } from "src/types/ReleaseScope";

/**
 * What a running reader is given each time it is asked: the scope the Beacon
 * speaks for at that moment, so a reader can name the authority and the
 * platform of the build it reads without the application repeating them. After
 * `replaceScope` it is the new scope. The scope is frozen, and a reader still
 * reads only local facts, never a document or a route.
 *
 * @example
 * ```ts
 * const reader = ({ scope }: RunningReaderContext): RunningRelease => ({
 *   identity: { status: "known", authority: scope.application, domain: "web-artifact", value: BUILD_ID },
 *   label: null,
 *   raw: {},
 * });
 * ```
 */
export type RunningReaderContext = {
  scope: ReleaseScope;
};
