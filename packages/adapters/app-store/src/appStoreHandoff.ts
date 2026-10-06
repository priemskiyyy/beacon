import { createUpdateMechanism } from "@priemskiyyy/beacon/adapter";
import type { ProviderResult } from "@priemskiyyy/beacon/adapter";

import type { AppStoreHandoffOptions } from "src/types/AppStoreHandoffOptions";
import type { AppStoreHandoffReceipt } from "src/types/AppStoreHandoffReceipt";
import type { AppStoreNative } from "src/types/AppStoreNative";
import { assertAppId } from "src/utils/assertAppId";
import { APP_STORE_DISTRIBUTION, STORE_URL } from "src/utils/constants/lookup";
import { OTHER_DISTRIBUTION } from "src/utils/constants/reasons";

/**
 * A mechanism that opens the App Store page of the configured app, for the
 * `native` subject. Its one command, `openStore`, takes an offer or none, since
 * remediation can send a user to the store without one. The destination is
 * built from the configured id alone. A resolved call means only that the OS
 * accepted the request: the user can decline or never return, so it is never
 * reported as an installation, and it does not wait for the app to return to
 * the foreground. It speaks for the `app-store` distribution only: in a session
 * whose scope says another, such as `google-play` or `development`,
 * `openStore` is unsupported with the reason `other-distribution` and opens
 * nothing.
 *
 * @example
 * ```ts
 * const mechanism = appStoreHandoff({ appId: "284882215", linking: Linking });
 * ```
 */
export const appStoreHandoff = ({ appId, linking }: AppStoreHandoffOptions) => {
  assertAppId(appId);

  const url = `${STORE_URL}/id${appId}`;

  return createUpdateMechanism({
    name: "app-store-handoff",
    subject: "native",
    open: ({ scope }): { native: AppStoreNative } => ({
      native: { linking, distribution: scope.distribution },
    }),
    commands: {
      openStore: {
        reference: "optional-offer",
        impacts: ["external-handoff"],
        binding: "store-destination",
        run: async (
          context,
        ): Promise<ProviderResult<AppStoreHandoffReceipt>> => {
          const { native } = context;

          // Decided here, with nothing opened, so a build outside the store is never sent to it.
          if (native.distribution !== APP_STORE_DISTRIBUTION) {
            return { status: "unsupported", reason: OTHER_DISTRIBUTION };
          }

          await native.linking.openURL(url);

          return {
            status: "accepted",
            receipt: { kind: "store-handoff-requested" },
          };
        },
      },
    },
  });
};
