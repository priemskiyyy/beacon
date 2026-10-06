// Typechecked, never run: React Native's real `Linking` satisfies the
// structural type the handoff uses, so Beacon never imports it at runtime,
// and a route's methods are derived from the command the mechanism declares.
import { newerRoute } from "@priemskiyyy/beacon";
import type { OfferReference, RouteHandle } from "@priemskiyyy/beacon";
import type { Linking } from "react-native";
import { expectTypeOf } from "vitest";

import { appleMarketingVersion } from "src/appleMarketingVersion";
import { appleVersion } from "src/appleVersion";
import { appStoreHandoff } from "src/appStoreHandoff";
import { appStoreLookup } from "src/appStoreLookup";
import type { AppStoreDocument } from "src/types/AppStoreDocument";
import type { LinkingLike } from "src/types/LinkingLike";

declare const linking: typeof Linking;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(linking.openURL).parameter(0).toEqualTypeOf<string>();
expectTypeOf(linking).toExtend<LinkingLike>();

export const store = appStoreLookup({
  appId: "284882215",
  country: "de",
  request: async () => ({ results: [] }),
});

expectTypeOf(store.select((document) => document.decision).project)
  .parameter(0)
  .toEqualTypeOf<AppStoreDocument>();

appStoreLookup({
  appId: "1",
  country: "de",
  // @ts-expect-error -- the client must resolve the lookup's entries, not a raw body.
  request: async () => ({ count: 0 }),
});

appStoreLookup({
  appId: "1",
  country: "de",
  // @ts-expect-error -- an entry has a version, or it is not an entry.
  request: async () => ({ results: [{ trackId: 1, bundleId: "a" }] }),
});

export const mechanism = appStoreHandoff({ appId: "284882215", linking });

export const binary = newerRoute({
  subject: "native",
  source: store.select((document) => document.decision),
  version: appleVersion(),
  current: appleMarketingVersion,
  mechanism,
});

newerRoute({
  subject: "native",
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
