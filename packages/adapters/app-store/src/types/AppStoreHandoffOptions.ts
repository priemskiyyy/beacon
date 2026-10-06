import type { LinkingLike } from "src/types/LinkingLike";

/**
 * Options for `appStoreHandoff()`. `appId` is the numeric App Store id the
 * application configured, and `linking` is the platform's link opener. The
 * destination is built from them alone, never taken from a manifest.
 *
 * @example
 * ```ts
 * appStoreHandoff({ appId: "284882215", linking: Linking });
 * ```
 */
export type AppStoreHandoffOptions = {
  appId: string;
  linking: LinkingLike;
};
