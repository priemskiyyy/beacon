import type { Projection } from "src/types/Projection";
import type { SourceRead } from "src/types/SourceRead";
import type { SourceReadContext } from "src/types/SourceReadContext";

/**
 * A reader of one release authority. It reads evidence and executes nothing:
 * commands belong to a mechanism. `select` gives a typed view of the document
 * without a second read.
 *
 * @example
 * ```ts
 * const manifest = createReleaseSource<Manifest>({ name: "release-manifest", read });
 * const web = manifest.select((document) => document.routes.web);
 * ```
 */
export type ReleaseSource<TDocument> = {
  name: string;
  read(context: SourceReadContext): Promise<SourceRead<TDocument>>;
  select<TSelected>(
    project: (document: TDocument) => TSelected,
  ): Projection<TDocument, TSelected>;
};
