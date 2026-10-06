// Typechecked, never run: a route's methods are derived from the commands the
// driver declares, and each flow is its own command with its own impacts.
import type {
  OfferReference,
  PreparedReference,
  RouteHandle,
} from "@priemskiyyy/beacon";
import type { Linking } from "react-native";
import { expectTypeOf } from "vitest";

import { googlePlay } from "src/googlePlay";
import { playStore } from "src/playStore";
import type { LinkingLike } from "src/types/LinkingLike";
import type { PlayBridge } from "src/types/PlayBridge";
import type { PlayNative } from "src/types/PlayNative";
import type { PlayReceipt } from "src/types/PlayReceipt";
import type { PlayStoreNative } from "src/types/PlayStoreNative";
import { GOOGLE_PLAY_DISTRIBUTION } from "src/utils/constants/distribution";

declare const bridge: PlayBridge;

export const binary = googlePlay({ bridge });

// @ts-expect-error -- the bridge is required: this adapter has no native code of its own.
googlePlay({});

export const wrong: PlayBridge = {
  ...bridge,
  // @ts-expect-error -- a bridge answers Play's four categories, not a made-up one.
  getUpdateInfo: async () => ({ availability: "maybe" }),
};

declare const handle: RouteHandle<"binary", typeof binary>;

declare const offer: OfferReference<"binary">;

declare const prepared: PreparedReference<"binary">;

export const flexible = handle.download({ offer });

export const immediate = handle.update({ offer });

export const complete = handle.restart({ prepared });

// @ts-expect-error -- completing needs the prepared download, not the offer.
handle.restart({ prepared: offer });

// @ts-expect-error -- a flow needs the offer, not a prepared download.
handle.download({ offer: prepared });

// @ts-expect-error -- a flow is a command of its own, not a parameter.
handle.download({ offer, flow: "immediate" });

// PLAY-17 Deleting asset packs is not an option of a flow, so nothing a remote policy says can enable it.
// @ts-expect-error -- there is no asset-pack deletion option.
handle.update({ offer, allowAssetPackDeletion: true });

// PLAY-16 Eligibility comes from Play alone: a release backend is not an option of the route.
// @ts-expect-error -- the route has no source that could override Play.
googlePlay({ bridge, source: bridge });

expectTypeOf(handle.native.get()).toEqualTypeOf<PlayNative | null>();

type Accepted<TOutcome> =
  TOutcome extends Promise<infer TSettled>
    ? TSettled extends { status: "accepted"; receipt: infer TReceipt }
      ? TReceipt
      : never
    : never;

// The exported receipt is what the three commands answer, no more and no less.
expectTypeOf<
  | Accepted<typeof flexible>
  | Accepted<typeof immediate>
  | Accepted<typeof complete>
>().toEqualTypeOf<PlayReceipt>();

// Each command answers its own receipt, not the union.
expectTypeOf<Accepted<typeof flexible>>().toEqualTypeOf<{
  kind: "update-downloaded";
}>();

export const receipt = async () => {
  const settled = await handle.restart({ prepared });

  if (settled.status === "accepted") {
    // @ts-expect-error -- an accepted completion request proves no installation.
    return settled.receipt.installed;
  }

  return null;
};

declare const linking: typeof Linking;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(linking.openURL).parameter(0).toEqualTypeOf<string>();
expectTypeOf(linking).toExtend<LinkingLike>();

export const store = playStore({
  applicationId: "com.example.notes",
  linking,
});

declare const storeHandle: RouteHandle<"store", typeof store>;

declare const storeOffer: OfferReference<"store">;

// The store route opens the page with an offer or without one, as the App Store's does.
export const openWithOffer = storeHandle.openStore({ offer: storeOffer });

export const openWithout = storeHandle.openStore();

expectTypeOf(storeHandle.native.get()).toEqualTypeOf<PlayStoreNative | null>();

// @ts-expect-error -- a store route has no flow to download, and no bridge to start one.
storeHandle.download({ offer: storeOffer });

// @ts-expect-error -- the link opener is required: this adapter has no native code of its own.
playStore({ applicationId: "com.example.notes" });

// @ts-expect-error -- the application id is required, since the page is built from it alone.
playStore({ linking });

// @ts-expect-error -- opening the store takes no parameters of its own.
storeHandle.openStore({ country: "de" });

// The distribution this adapter speaks for is one word, exported so a scope says it by name.
export const distribution: "google-play" = GOOGLE_PLAY_DISTRIBUTION;

// @ts-expect-error -- it is one word, not any text.
export const other: typeof GOOGLE_PLAY_DISTRIBUTION = "app-store";
