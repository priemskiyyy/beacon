// Typechecked, never run: a route's methods are derived from the commands the
// driver declares, and each flow is its own command with its own impacts.
import type {
  OfferReference,
  PreparedReference,
  RouteHandle,
} from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { googlePlay } from "src/googlePlay";
import type { PlayBridge } from "src/types/PlayBridge";
import type { PlayNative } from "src/types/PlayNative";

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

export const flexible = handle.startFlexibleUpdate({ offer });

export const immediate = handle.startImmediateUpdate({ offer });

export const complete = handle.completeUpdate({ prepared });

// @ts-expect-error -- completing needs the prepared download, not the offer.
handle.completeUpdate({ offer });

// @ts-expect-error -- a flow is a command of its own, not a parameter.
handle.startFlexibleUpdate({ offer, flow: "immediate" });

// PLAY-17 Deleting asset packs is not an option of a flow, so nothing a remote policy says can enable it.
// @ts-expect-error -- there is no asset-pack deletion option.
handle.startImmediateUpdate({ offer, allowAssetPackDeletion: true });

// PLAY-16 Eligibility comes from Play alone: a release backend is not an option of the route.
// @ts-expect-error -- the route has no source that could override Play.
googlePlay({ bridge, source: bridge });

expectTypeOf(handle.native.get()).toEqualTypeOf<PlayNative | null>();

export const receipt = async () => {
  const settled = await handle.completeUpdate({ prepared });

  if (settled.status === "accepted") {
    // @ts-expect-error -- an accepted completion request proves no installation.
    return settled.receipt.installed;
  }

  return null;
};
