import type { SourceRead } from "@priemskiyyy/beacon";

import type { HttpAnswer } from "src/types/HttpAnswer";

type Changed<TDocument> = Exclude<
  HttpAnswer<TDocument>,
  { status: "not-modified" }
>;

/** The read a changed answer stands for: its document and evidence, without the client's own envelope. */
export const toSourceRead = <TDocument>({
  document,
  revision,
  digest,
  issuer,
  expiresAt,
}: Changed<TDocument>): SourceRead<TDocument> => ({
  document,
  ...(revision === undefined ? {} : { revision }),
  ...(digest === undefined ? {} : { digest }),
  ...(issuer === undefined ? {} : { issuer }),
  ...(expiresAt === undefined ? {} : { expiresAt }),
});
