import type { ReleaseSourceFixture } from "src/testing/types/ReleaseSourceFixture";
import type { ReleaseScope } from "src/types/ReleaseScope";

/**
 * What a source's conformance suite is run over: a name for the report, and a
 * `create` that makes a fresh fixture for every test.
 *
 * @example
 * ```ts
 * const options: ReleaseSourceConformanceOptions<Manifest> = {
 *   name: "http",
 *   create: () => ({ source: http({ request: backend.request }), reads: backend.reads }),
 * };
 * ```
 */
export type ReleaseSourceConformanceOptions<TDocument> = {
  name: string;
  create: () => ReleaseSourceFixture<TDocument>;
  /** The scope the source is read for, when it speaks for one distribution only. */
  scope?: ReleaseScope;
};
