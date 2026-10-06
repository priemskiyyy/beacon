import type { ReleaseScope, SourceRead } from "@priemskiyyy/beacon";

/** The last answer a source accepted, and the scope and partition it speaks for. */
export type HttpMemory<TDocument> = {
  scope: ReleaseScope;
  partition: string | null;
  validator: string | null;
  read: SourceRead<TDocument>;
};
