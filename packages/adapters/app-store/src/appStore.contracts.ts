// Typechecked, never run: React Native's real `Linking` satisfies the
// structural type the handoff uses, so Beacon never imports it at runtime,
// and a route's methods are derived from the command the mechanism declares.
import { newerRoute } from "@priemskiyyy/beacon";
import type { OfferReference, RouteHandle } from "@priemskiyyy/beacon";
import type { Linking } from "react-native";
import { expectTypeOf } from "vitest";

import { appleMarketingVersion } from "src/appleMarketingVersion";
import { appleVersion } from "src/appleVersion";
import { appStore } from "src/appStore";
import { appStoreHandoff } from "src/appStoreHandoff";
import { appStoreLookup } from "src/appStoreLookup";
import type { AppStoreDocument } from "src/types/AppStoreDocument";
import type { AppStoreNative } from "src/types/AppStoreNative";
import type { LinkingLike } from "src/types/LinkingLike";
import { APP_STORE_DISTRIBUTION } from "src/utils/constants/lookup";

declare const linking: typeof Linking;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(linking.openURL).parameter(0).toEqualTypeOf<string>();
expectTypeOf(linking).toExtend<LinkingLike>();

export const store = appStoreLookup({
  appId: "284882215",
  country: "de",
  fetch: async () => ({ results: [] }),
});

expectTypeOf(store.select((document) => document.decision).project)
  .parameter(0)
  .toEqualTypeOf<AppStoreDocument>();

appStoreLookup({
  appId: "1",
  country: "de",
  // @ts-expect-error -- the client must resolve the lookup's entries, not a raw body.
  fetch: async () => ({ count: 0 }),
});

appStoreLookup({
  appId: "1",
  country: "de",
  // @ts-expect-error -- an entry has a version, or it is not an entry.
  fetch: async () => ({ results: [{ trackId: 1, bundleId: "a" }] }),
});

export const mechanism = appStoreHandoff({ appId: "284882215", linking });

export const binary = newerRoute({
  source: store.select((document) => document.decision),
  version: appleVersion(),
  current: appleMarketingVersion,
  mechanism,
});

newerRoute({
  // @ts-expect-error -- a store that answers marketing versions is not a number domain.
  source: store.select((document) => document.decision),
  version: {
    name: "numbers",
    parse: (input: number) => input,
    compare: () => "equal",
    admits: () => true,
  },
  // @ts-expect-error -- a marketing version is a string, not a number domain.
  current: appleMarketingVersion,
  mechanism,
});

declare const handle: RouteHandle<"binary", typeof binary>;

declare const offer: OfferReference<"binary">;

export const withOffer = handle.openStore({ offer });

export const withoutOffer = handle.openStore();

// BIND-02 A store route has no download or install method in its inferred type.
// @ts-expect-error -- a store route cannot download.
handle.download({ offer });

// @ts-expect-error -- opening the store takes no parameters of its own.
handle.openStore({ offer, country: "de" });

export const receipt = async () => {
  const settled = await handle.openStore();

  if (settled.status === "accepted") {
    // @ts-expect-error -- an accepted handoff claims no installation.
    return settled.receipt.installed;
  }

  return null;
};

// The distribution this adapter speaks for is one word, exported so a scope says it by name.
export const distribution: "app-store" = APP_STORE_DISTRIBUTION;

// @ts-expect-error -- it is one word, not any text.
export const other: typeof APP_STORE_DISTRIBUTION = "google-play";

// The ready-made route is the composition above, and has the same commands.
export const ready = appStore({
  appId: "284882215",
  country: "de",
  bundleId: "com.example.notes",
  linking,
});

declare const readyHandle: RouteHandle<"store", typeof ready>;

declare const readyOffer: OfferReference<"store">;

export const readyWithOffer = readyHandle.openStore({ offer: readyOffer });

export const readyWithout = readyHandle.openStore();

expectTypeOf(readyHandle.native.get()).toEqualTypeOf<AppStoreNative | null>();

// @ts-expect-error -- a store route cannot download, composed or not.
readyHandle.download({ offer: readyOffer });

// @ts-expect-error -- the link opener is required: this adapter imports nothing itself.
appStore({ appId: "284882215", country: "de" });

// @ts-expect-error -- the lookup client is optional, but when it is given it resolves entries.
appStore({ appId: "1", country: "de", linking, fetch: async () => ({}) });

// A client of your own still fits.
export const withClient = appStore({
  appId: "1",
  country: "de",
  linking,
  fetch: async () => ({ results: [] }),
});
