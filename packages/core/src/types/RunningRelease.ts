import type { ReleaseIdentity } from "src/types/ReleaseIdentity";

/**
 * A release that is executing right now: its identity, a label for people, and
 * the raw values its platform reported, kept apart from the normalized
 * identity. Only a local reader of the running code may produce one, never a
 * remote manifest.
 *
 * @example
 * ```ts
 * const native: RunningRelease = {
 *   identity: { status: "known", authority: "com.example.notes", domain: "native-android-build", value: "108" },
 *   label: "2.4.0",
 *   raw: { versionName: "2.4.0", versionCode: 108 },
 * };
 * ```
 */
export type RunningRelease = {
  identity: ReleaseIdentity;
  label: string | null;
  raw: Record<string, string | number | boolean | null>;
};
