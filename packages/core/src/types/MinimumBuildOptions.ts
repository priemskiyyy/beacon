import type { Projection } from "src/types/Projection";

/**
 * What `minimumBuild` is made from: the view of a source's document that holds
 * the lowest build the server still accepts, as text or a number, and, to send
 * an older build somewhere, the route that does it and how much it matters.
 * `level` only has a meaning beside a `remediation`, so one without the other
 * does not compile. `authority` is the application id the native build must be
 * named under when the reader does not check it itself: a binary of another
 * application, such as Expo Go running your code, is then unknown.
 *
 * @example
 * ```ts
 * const options: MinimumBuildOptions<unknown, "store"> = {
 *   source: manifest.select((document) => document.minimumBuild),
 *   remediation: "store",
 *   level: "required",
 * };
 * ```
 */
export type MinimumBuildOptions<TDocument, TRoute extends string> = {
  source: Projection<TDocument, string | number>;
  authority?: string;
} & (
  | { remediation?: undefined; level?: undefined }
  | { remediation: TRoute; level?: "required" | "recommended" }
);
