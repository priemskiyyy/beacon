import { createUpdateMechanism } from "@priemskiyyy/beacon";
import type { ProviderResult } from "@priemskiyyy/beacon";

import type { AppStoreHandoffOptions } from "src/types/AppStoreHandoffOptions";
import type { AppStoreHandoffReceipt } from "src/types/AppStoreHandoffReceipt";
import { assertAppId } from "src/utils/assertAppId";
import { STORE_URL } from "src/utils/constants/lookup";

/**
 * A mechanism that opens the App Store page of the configured app. Its one
 * command, `openStore`, takes an offer or none, since remediation can send a
 * user to the store without one. The destination is built from the configured
 * id alone. A resolved call means only that the OS accepted the request: the
 * user can decline or never return, so it is never reported as an
 * installation, and it does not wait for the app to return to the foreground.
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
    open: () => ({ native: { linking } }),
    commands: {
      openStore: {
        reference: "optional-offer",
        impacts: ["external-handoff"],
        binding: "store-destination",
        run: async (
          context,
        ): Promise<ProviderResult<AppStoreHandoffReceipt>> => {
          await context.native.linking.openURL(url);

          return {
            status: "accepted",
            receipt: { kind: "store-handoff-requested" },
          };
        },
      },
    },
  });
};
