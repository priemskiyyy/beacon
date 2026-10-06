import { Beacon } from "@priemskiyyy/beacon";
import type { OfferReference, RunningRelease } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import {
  APP_STORE_DISTRIBUTION,
  appStore,
} from "@priemskiyyy/beacon-app-store";
import {
  GOOGLE_PLAY_DISTRIBUTION,
  playStore,
} from "@priemskiyyy/beacon-google-play";
import { expect, test } from "vitest";

// The adapters cannot import each other, so the store routes of both are held to one shape by running them as an application does: one name, and one call, whichever store the platform has.

const createOpener = () => {
  const opened: string[] = [];

  return {
    opened,
    linking: {
      openURL: async (url: string) => {
        opened.push(url);
      },
    },
  };
};

type Opener = ReturnType<typeof createOpener>;

// The App Store route compares with the binary that runs, so it needs a native reader, and what it says is not what these tests are about.
const readNothing = (): RunningRelease => ({
  identity: { status: "unknown", reason: "build-not-read" },
  label: null,
  raw: {},
});

type Platform = "ios" | "android";

const readStoreRoute = (platform: Platform, { linking }: Opener) => {
  if (platform === "ios") {
    return appStore({
      appId: "284882215",
      country: "us",
      linking,
      fetch: async () => ({ results: [] }),
    });
  }

  return playStore({ applicationId: "com.example.notes", linking });
};

const create = (platform: Platform) => {
  const opener = createOpener();

  const beacon = new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform,
      distribution:
        platform === "ios" ? APP_STORE_DISTRIBUTION : GOOGLE_PLAY_DISTRIBUTION,
    },
    running: { boot: { id: "boot-1" }, native: readNothing },
    routes: { store: readStoreRoute(platform, opener) },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, opener };
};

test("a forced upgrade is one call on either platform: the route is named the same, and opens the store of its own", async () => {
  const stores: Array<{ platform: Platform; url: string }> = [
    { platform: "ios", url: "https://apps.apple.com/app/id284882215" },
    { platform: "android", url: "market://details?id=com.example.notes" },
  ];

  for (const { platform, url } of stores) {
    const { beacon, opener } = create(platform);

    beacon.start();

    await expect(beacon.route("store").openStore()).resolves.toMatchObject({
      status: "accepted",
      receipt: { kind: "store-handoff-requested" },
    });
    expect(opener.opened).toEqual([url]);
  }
});

test("a scope of the other store is refused by each, so neither opens the page of the wrong one", async () => {
  const others: Array<{ distribution: string; route: Platform }> = [
    { distribution: GOOGLE_PLAY_DISTRIBUTION, route: "ios" },
    { distribution: APP_STORE_DISTRIBUTION, route: "android" },
    { distribution: "development", route: "ios" },
    { distribution: "development", route: "android" },
  ];

  for (const { distribution, route } of others) {
    const opener = createOpener();

    const beacon = new Beacon({
      scope: {
        application: "com.example.notes",
        environment: "production",
        platform: route,
        distribution,
      },
      running: { boot: { id: "boot-1" }, native: readNothing },
      routes: { store: readStoreRoute(route, opener) },
      clock: createTestClock({ now: 1_000 }),
    });

    beacon.start();

    await expect(beacon.route("store").openStore()).resolves.toEqual({
      status: "unsupported",
      reason: "other-distribution",
    });
    expect(opener.opened).toEqual([]);
  }
});

test("the same handle types both routes, with or without an offer, and neither can download", () => {
  const { beacon } = create("android");
  const store = beacon.route("store");

  const offer: OfferReference<"store"> | null = null;

  expect(typeof store.openStore).toBe("function");
  expect(offer).toBeNull();

  if (offer !== null) {
    store.openStore({ offer });
  }

  // @ts-expect-error -- a store route has no download, whichever store it is.
  expect(store.download).toBeUndefined();
});
