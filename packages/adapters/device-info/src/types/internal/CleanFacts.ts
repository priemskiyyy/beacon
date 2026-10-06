/** What a native SDK reported about the installed binary once it is text with no space around it, or `null` where it gave none. */
export type CleanFacts = {
  applicationId: string | null;
  version: string | null;
  build: string | null;
};
