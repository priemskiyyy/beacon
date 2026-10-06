/**
 * Which release something is, as far as its authority can say. Two known
 * identities compare only within one authority and one domain, and an unknown
 * identity is never equal to anything, another unknown one included. Labels,
 * versions, timestamps and URLs are not identities.
 *
 * @example
 * ```ts
 * const build: ReleaseIdentity = {
 *   status: "known",
 *   authority: "com.example.notes",
 *   domain: "web-artifact",
 *   value: "web-build-a",
 * };
 * const embedded: ReleaseIdentity = { status: "unknown", reason: "not-reported" };
 * ```
 */
export type ReleaseIdentity =
  | {
      status: "known";
      /** Who assigns the value, such as an application ID. */
      authority: string;
      /** What kind of thing the value names, such as `web-artifact` or `expo-update`. */
      domain: string;
      value: string;
    }
  | {
      status: "unknown";
      /** A short machine-readable code for why nothing identifies the release. */
      reason: string;
    };
