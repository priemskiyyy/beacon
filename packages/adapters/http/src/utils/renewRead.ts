import type { SourceRead } from "@priemskiyyy/beacon";

/**
 * The same answer with a new expiry, as a revalidation gives it. Without a
 * new expiry the old one stays, so an answer is never fresher than the
 * backend said.
 */
export const renewRead = <TDocument>(
  held: SourceRead<TDocument>,
  expiresAt: number | undefined,
): SourceRead<TDocument> => {
  if (expiresAt === undefined) {
    return held;
  }

  return { ...held, expiresAt };
};
