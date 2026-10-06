import type { RunningRelease } from "src/types/RunningRelease";

/**
 * The one local authority for a running fact: it reads what is executing from
 * the build, the native module or the browser, and never from a remote
 * manifest. It may answer at once or later.
 *
 * @example
 * ```ts
 * const reader: RunningReader = () => ({
 *   identity: { status: "known", authority: "com.example.notes", domain: "web-artifact", value: BUILD_ID },
 *   label: APP_LABEL,
 *   raw: {},
 * });
 * ```
 */
export type RunningReader = () => RunningRelease | Promise<RunningRelease>;
