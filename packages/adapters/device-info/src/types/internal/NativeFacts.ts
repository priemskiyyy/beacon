/** What a native SDK reported about the installed binary, before any of it is trusted. */
export type NativeFacts = {
  applicationId: string | null | undefined;
  version: string | null | undefined;
  build: string | null | undefined;
};
