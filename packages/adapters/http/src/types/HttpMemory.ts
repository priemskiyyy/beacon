import type { ReleaseScope, SourceRead } from "@priemskiyyy/beacon";

/** The last answer a source accepted, and the scope it speaks for. */
export type HttpMemory<TDocument> = {
  scope: ReleaseScope;
  validator: string | null;
  read: SourceRead<TDocument>;
};
