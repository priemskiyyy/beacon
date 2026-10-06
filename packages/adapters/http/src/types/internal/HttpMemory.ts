import type { ReleaseScope, SourceRead } from "@priemskiyyy/beacon";

/**
 * The last answer a source accepted, and the scope it speaks for. The scope is
 * matched by identity, since Beacon hands over the same frozen scope for as
 * long as it is in force: a copy is another scope and finds nothing held,
 * which costs one unconditional read and never shares an account's answer.
 */
export type HttpMemory<TDocument> = {
  scope: ReleaseScope;
  validator: string | null;
  read: SourceRead<TDocument>;
};
