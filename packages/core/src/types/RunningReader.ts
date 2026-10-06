import type { RunningReaderContext } from "src/types/RunningReaderContext";
import type { RunningRelease } from "src/types/RunningRelease";
import type { RunningSubject } from "src/types/RunningSubject";

/**
 * The one local authority for a running fact: it reads what is executing from
 * the build, the native module or the browser, and never from a remote
 * manifest. It may answer at once or later, and it is given the scope of the
 * read, which a reader that needs none of it may leave out: a function with no
 * parameter is a reader.
 *
 * `TSubject` is a brand, for the readers that are made for one subject, such as
 * the reader of the web build: `running.web` does not take the reader of the
 * bundle. Without it a reader is of no particular subject and fits any, as a
 * function of your own does, and the brand is a type only, so nothing is set at
 * runtime. `RunningReader<RunningSubject>` is a reader of any subject, branded
 * or not.
 *
 * @example
 * ```ts
 * const reader: RunningReader<"web"> = ({ scope }) => ({
 *   identity: { status: "known", authority: scope.application, domain: "web-artifact", value: BUILD_ID },
 *   label: APP_LABEL,
 *   raw: {},
 * });
 * ```
 */
export type RunningReader<TSubject extends RunningSubject = never> = ((
  context: RunningReaderContext,
) => RunningRelease | Promise<RunningRelease>) & { subject?: TSubject };
