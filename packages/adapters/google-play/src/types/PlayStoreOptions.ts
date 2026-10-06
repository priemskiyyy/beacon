import type { LinkingLike } from "src/types/LinkingLike";

/**
 * Options for `playStore()`. `applicationId` is the Android application id of
 * the app, the same as `scope.application`, and `linking` is the platform's
 * link opener, such as React Native's `Linking`. The destination is built from
 * the application id alone, never from a manifest.
 *
 * @example
 * ```ts
 * playStore({ applicationId: "com.example.notes", linking: Linking });
 * ```
 */
export type PlayStoreOptions = {
  applicationId: string;
  linking: LinkingLike;
};
