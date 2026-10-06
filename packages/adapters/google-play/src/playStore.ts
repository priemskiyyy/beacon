import { createReleaseDriver } from "@priemskiyyy/beacon/adapter";
import type { RouteBody } from "@priemskiyyy/beacon";
import type {
  CommandMap,
  ObservationDraft,
  ProviderResult,
} from "@priemskiyyy/beacon/adapter";

import type { PlayStoreNative } from "src/types/PlayStoreNative";
import type { PlayStoreOptions } from "src/types/PlayStoreOptions";
import type { PlayStoreReceipt } from "src/types/PlayStoreReceipt";
import { assertApplicationId } from "src/utils/assertApplicationId";
import { GOOGLE_PLAY_DISTRIBUTION } from "src/utils/constants/distribution";
import { NO_LOOKUP, OTHER_DISTRIBUTION } from "src/utils/constants/reasons";
import { MARKET_URL, STORE_URL } from "src/utils/constants/store";

const check = async (): Promise<ObservationDraft<RouteBody>> => ({
  status: "none",
  reason: "no-decision",
  detail: NO_LOOKUP,
});

/**
 * Google Play's store page as a route, with no bridge and no native module of
 * your own: its one command, `openStore`, opens the page of the application in
 * the Play Store app, and in the browser where nothing handles the market
 * link. It takes an offer or none, as the App Store's does, so a cross-platform
 * forced upgrade is the same call on both. The destination is built from the
 * application id alone. A resolved call means only that the OS accepted the
 * request: the user can decline or never return, so it is never reported as an
 * installation. The route asks nobody what the store has, so it never offers
 * anything: its check is no offer, which is not proof that no release exists.
 * It speaks for the `google-play` distribution only: in a session whose scope says
 * another, `openStore` is unsupported with the reason `other-distribution` and
 * opens nothing. For Play's own in-app flows, which need a native bridge you
 * write, see `googlePlay`.
 *
 * @example
 * ```ts
 * const routes = {
 *   store: playStore({ applicationId: "com.example.notes", linking: Linking }),
 * };
 * ```
 */
export const playStore = ({ applicationId, linking }: PlayStoreOptions) => {
  assertApplicationId(applicationId);

  const market = `${MARKET_URL}?id=${applicationId}`;

  const web = `${STORE_URL}?id=${applicationId}`;

  const commands = {
    openStore: {
      reference: "optional-offer",
      impacts: ["external-handoff"],
      binding: "store-destination",
      run: async (context): Promise<ProviderResult<PlayStoreReceipt>> => {
        const { native } = context;

        // Decided here, with nothing opened, so a build outside Play is never sent to it.
        if (native.distribution !== GOOGLE_PLAY_DISTRIBUTION) {
          return { status: "unsupported", reason: OTHER_DISTRIBUTION };
        }

        try {
          await native.linking.openURL(market);
        } catch {
          // Nothing handles the market link where the Play Store app is missing, and the web page is what is left.
          await native.linking.openURL(web);
        }

        return {
          status: "accepted",
          receipt: { kind: "store-handoff-requested" },
        };
      },
    },
  } satisfies CommandMap<PlayStoreNative, RouteBody, RouteBody>;

  return createReleaseDriver<
    PlayStoreNative,
    RouteBody,
    RouteBody,
    typeof commands
  >({
    name: "play-store",
    subject: "native",
    prepares: false,
    open: ({ scope }) => ({
      native: { linking, distribution: scope.distribution },
      check,
    }),
    commands,
  });
};
