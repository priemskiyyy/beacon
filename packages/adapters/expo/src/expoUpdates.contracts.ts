// Typechecked, never run: the real `expo-updates` module satisfies the
// structural type the adapter uses, so Beacon never imports it at runtime,
// and a route's methods are derived from the commands the driver declares.
import { createReleaseDriver } from "@priemskiyyy/beacon";
import type {
  ObservationDraft,
  OfferReference,
  PreparedReference,
  RouteHandle,
  RunningReader,
  RunningReaders,
} from "@priemskiyyy/beacon";
import type * as Updates from "expo-updates";
import { expectTypeOf } from "vitest";

import { applyUpdate } from "src/applyUpdate";
import { expoBundle } from "src/expoBundle";
import { expoUpdates } from "src/expoUpdates";
import { createFakeUpdates } from "src/mock/createFakeUpdates";
import type { AppliedUpdate } from "src/types/AppliedUpdate";
import type { ExpoBody } from "src/types/ExpoBody";
import type { ExpoDownloadReceipt } from "src/types/ExpoDownloadReceipt";
import type { ExpoNative } from "src/types/ExpoNative";
import type { ExpoReloadReceipt } from "src/types/ExpoReloadReceipt";
import type { UpdatesLike } from "src/types/UpdatesLike";

declare const sdk: typeof Updates;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(sdk.updateId).toEqualTypeOf<string | null>();
expectTypeOf(sdk).toExtend<UpdatesLike>();

export const ota = expoUpdates({ updates: sdk });

declare const development: boolean;

// The fake goes where the module goes, so a development build can swap one for the other.
export const swapped = expoUpdates({
  updates: development ? createFakeUpdates({ available: true }) : sdk,
});

expectTypeOf(createFakeUpdates()).toExtend<UpdatesLike>();

export const bundle: RunningReaders["bundle"] = expoBundle({ updates: sdk });

export const reader: RunningReader<"bundle"> = expoBundle({ updates: sdk });

export const slots: RunningReaders = {
  bundle: reader,
  // @ts-expect-error -- the reader of the expo bundle is made for the bundle subject, not the web build.
  web: reader,
};

// @ts-expect-error -- the module is the SDK's, not a random object.
expoUpdates({ updates: {} });

// @ts-expect-error -- the reader takes the module in an object, as the route does.
expoBundle(sdk);

// @ts-expect-error -- the module is the SDK's, not a random object.
expoBundle({ updates: {} });

// @ts-expect-error -- the SDK is required: this adapter imports nothing itself.
expoUpdates({});

declare const handle: RouteHandle<"ota", typeof ota>;

declare const offer: OfferReference<"ota">;

declare const prepared: PreparedReference<"ota">;

export const download = handle.download({ offer });

export const reload = handle.reload({ prepared });

// @ts-expect-error -- a download needs the offer the user was shown.
handle.download();

// @ts-expect-error -- a reload needs a prepared target, not an offer.
handle.reload({ prepared: offer });

// @ts-expect-error -- a download needs an offer, not a prepared target.
handle.download({ offer: prepared });

// @ts-expect-error -- the download command takes no parameters of its own.
handle.download({ offer, channel: "staging" });

expectTypeOf(handle.native.get()).toEqualTypeOf<ExpoNative | null>();

export const receipt = async () => {
  const settled = await handle.download({ offer });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<ExpoDownloadReceipt>();

    // @ts-expect-error -- an accepted download claims no installation.
    return settled.receipt.installed;
  }

  return null;
};

export const reloadReceipt = async () => {
  const settled = await handle.reload({ prepared });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<ExpoReloadReceipt>();

    // @ts-expect-error -- an accepted reload claims no update is running.
    return settled.receipt.updated;
  }

  return null;
};

// `applyUpdate` takes the handle of an Expo route, whatever its name.
export const applied = applyUpdate(handle);

expectTypeOf(applied).toEqualTypeOf<Promise<AppliedUpdate>>();

declare const native: ExpoNative;

export const hollow = createReleaseDriver<
  ExpoNative,
  ExpoBody,
  ExpoBody,
  Record<never, never>
>({
  name: "hollow",
  subject: "bundle",
  prepares: true,
  open: () => ({
    native,
    check: async (): Promise<ObservationDraft<ExpoBody>> => ({
      status: "none",
      reason: "no-decision",
      detail: null,
    }),
  }),
  commands: {},
});

declare const hollowHandle: RouteHandle<"hollow", typeof hollow>;

// @ts-expect-error -- a route with no download and no reload is not an Expo route.
applyUpdate(hollowHandle);

// @ts-expect-error -- the route handle is what it takes, not the Beacon.
applyUpdate({});

export const appliedStep = async () => {
  const result = await applyUpdate(handle);

  if (result.step === "reload" && result.download !== null) {
    expectTypeOf(result.download.status).toEqualTypeOf<"accepted">();
    expectTypeOf(result.download.receipt).toEqualTypeOf<ExpoDownloadReceipt>();
  }

  if (result.step === "none") {
    // @ts-expect-error -- no command ran, so there is no outcome to read.
    return result.outcome;
  }

  return null;
};
