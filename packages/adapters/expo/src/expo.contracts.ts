// Typechecked, never run: the real `expo-updates` module satisfies the
// structural type the adapter uses, so Beacon never imports it at runtime,
// and a route's methods are derived from the commands the driver declares.
import type {
  OfferReference,
  PreparedReference,
  RouteHandle,
  RunningReaders,
} from "@priemskiyyy/beacon";
import type * as Updates from "expo-updates";
import { expectTypeOf } from "vitest";

import { expoBundle } from "src/expoBundle";
import { expoUpdates } from "src/expoUpdates";
import type { ExpoNative } from "src/types/ExpoNative";
import type { UpdatesLike } from "src/types/UpdatesLike";

declare const sdk: typeof Updates;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(sdk.updateId).toEqualTypeOf<string | null>();
expectTypeOf(sdk).toExtend<UpdatesLike>();

export const ota = expoUpdates({ updates: sdk });

export const bundle: RunningReaders["bundle"] = expoBundle(sdk);

// @ts-expect-error -- the module is the SDK's, not a random object.
expoUpdates({ updates: {} });

// @ts-expect-error -- the SDK is required: this adapter imports nothing itself.
expoUpdates({});

declare const handle: RouteHandle<"ota", typeof ota>;

declare const offer: OfferReference<"ota">;

declare const prepared: PreparedReference<"ota">;

export const download = handle.download({ offer });

export const reload = handle.requestReload({ prepared });

// @ts-expect-error -- a download needs the offer the user was shown.
handle.download();

// @ts-expect-error -- a reload needs a prepared target, not an offer.
handle.requestReload({ prepared: offer });

// @ts-expect-error -- a download needs an offer, not a prepared target.
handle.download({ offer: prepared });

// @ts-expect-error -- the download command takes no parameters of its own.
handle.download({ offer, channel: "staging" });

expectTypeOf(handle.native.get()).toEqualTypeOf<ExpoNative | null>();

export const receipt = async () => {
  const settled = await handle.download({ offer });

  if (settled.status === "accepted") {
    // @ts-expect-error -- an accepted download claims no installation.
    return settled.receipt.installed;
  }

  return null;
};
