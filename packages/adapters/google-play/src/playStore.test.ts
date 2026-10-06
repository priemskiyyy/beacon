import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { fakeLinking } from "src/fakeLinking.fixture";
import { playStore } from "src/playStore";
import { GOOGLE_PLAY_DISTRIBUTION } from "src/utils/constants/distribution";

const APPLICATION = "com.example.notes";

const MARKET = `market://details?id=${APPLICATION}`;

const WEB = `https://play.google.com/store/apps/details?id=${APPLICATION}`;

const SCOPE: ReleaseScope = {
  application: APPLICATION,
  environment: "production",
  platform: "android",
  distribution: GOOGLE_PLAY_DISTRIBUTION,
};

const create = (refused: string[] = [], distribution = SCOPE.distribution) => {
  const link = fakeLinking(refused);

  const beacon = new Beacon({
    scope: { ...SCOPE, distribution },
    running: { boot: { id: "boot-1" } },
    routes: {
      store: playStore({ applicationId: APPLICATION, linking: link.linking }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  return { ...link, beacon, store: beacon.route("store") };
};

test("making the route and the beacon open nothing, and the distribution is the word the package exports", () => {
  const { asked, store } = create();

  expect(asked).toEqual([]);
  expect(store.state.get().observation).toEqual({
    status: "unknown",
    reason: "not-checked",
  });
  expect(GOOGLE_PLAY_DISTRIBUTION).toBe("google-play");
});

test("opening the store opens the Play Store app on the page of the application, and is a request and nothing more", async () => {
  const { beacon, store, asked } = create();

  beacon.start();

  await expect(store.openStore()).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "store-handoff-requested" },
  });
  expect(asked).toEqual([MARKET]);
  expect(store.state.get().operation).toEqual({ state: "idle" });
});

test("where nothing handles the market link the web page of the store is opened instead", async () => {
  const { beacon, store, asked } = create(["market:"]);

  beacon.start();

  await expect(store.openStore()).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "store-handoff-requested" },
  });
  expect(asked).toEqual([MARKET, WEB]);
});

test("a store that can be opened neither way is a failed command, and is asked twice and no more", async () => {
  const { beacon, store, asked } = create(["market:", "https:"]);

  beacon.start();

  await expect(store.openStore()).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(asked).toEqual([MARKET, WEB]);
});

test("STORE-09 a build outside Google Play is unsupported and opens nothing, so it is never sent to the wrong store", async () => {
  for (const distribution of ["app-store", "development", "testflight", ""]) {
    const { beacon, store, asked } = create([], distribution);

    beacon.start();

    await expect(store.openStore()).resolves.toEqual({
      status: "unsupported",
      reason: "other-distribution",
    });
    expect(asked).toEqual([]);
  }
});

test("the route has no authority to ask, so a check is no offer, and never proof that no release exists", async () => {
  const { beacon, store } = create();

  beacon.start();

  await expect(store.check()).resolves.toMatchObject({ status: "succeeded" });
  expect(store.state.get()).toMatchObject({
    observation: {
      status: "none",
      reason: "no-decision",
      detail: "no-lookup",
    },
    prepared: { status: "not-applicable" },
  });
});

test("a handoff that ends without an installation changes nothing about what runs", async () => {
  const { beacon, store } = create();

  beacon.start();

  const running = beacon.running.get();

  await store.openStore();

  expect(beacon.running.get()).toEqual(running);
  expect(store.state.get().observation).toMatchObject({ status: "unknown" });
});

test("the native handle names the link opener and the distribution of the session while it runs", () => {
  const { beacon, store, linking } = create();

  expect(store.native.get()).toBeNull();

  beacon.start();

  expect(store.native.get()).toEqual({
    linking,
    distribution: GOOGLE_PLAY_DISTRIBUTION,
  });
});

test("an application id that is not one is refused when the route is made, so no link is built from it", () => {
  const { linking } = fakeLinking();

  for (const applicationId of [
    "",
    "notes",
    "com.example.notes&hl=de",
    "com.example/../x",
    "1com.example",
    "com..example",
    "com.example.",
  ]) {
    expect(() => playStore({ applicationId, linking })).toThrow(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
    );
  }
});
