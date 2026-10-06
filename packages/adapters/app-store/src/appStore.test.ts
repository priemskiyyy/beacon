import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import type { RunningRelease } from "@priemskiyyy/beacon";
import { afterEach, expect, test, vi } from "vitest";

import { appStore } from "src/appStore";
import {
  APP_ID,
  BUNDLE_ID,
  entry,
  fakeLinking,
  fakeStore,
  SCOPE,
} from "src/fakeStore.fixture";

const nativeRelease = (shortVersion: string | null): RunningRelease => ({
  identity: {
    status: "known",
    authority: BUNDLE_ID,
    domain: "ios-build",
    value: "412",
  },
  label: null,
  raw:
    shortVersion === null
      ? { buildNumber: "412" }
      : { shortVersion, buildNumber: "412" },
});

const create = (
  running: string | null = "3.2.0",
  distribution = "app-store",
) => {
  const store = fakeStore();
  const link = fakeLinking();

  const binary = appStore({
    appId: APP_ID,
    country: "de",
    bundleId: BUNDLE_ID,
    linking: link.linking,
    fetch: store.fetch,
  });

  const beacon = new Beacon({
    scope: { ...SCOPE, distribution },
    running: { boot: { id: "boot-1" }, native: () => nativeRelease(running) },
    routes: { binary },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, store, link, binary: beacon.route("binary") };
};

test("a newer marketing version in the store is an offer, whose metadata is advisory", async () => {
  const { beacon, binary } = create("3.2.0");

  beacon.start();
  await binary.check();

  expect(binary.state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { label: "3.3.0", order: "3.3.0" } },
    evidence: { source: "app-store-lookup", issuer: "app-store" },
  });
});

test("the same marketing version is not an offer", async () => {
  const { beacon, binary } = create("3.3.0");

  beacon.start();
  await binary.check();

  expect(binary.state.get().observation).toMatchObject({ status: "none" });
});

test("an older marketing version in the store is not an offer", async () => {
  const { beacon, binary } = create("3.4.0");

  beacon.start();
  await binary.check();

  expect(binary.state.get().observation).toMatchObject({
    status: "none",
    reason: "older-than-current",
  });
});

test("STORE-04 without the running marketing version nothing claims a newer one", async () => {
  const { beacon, binary } = create(null);

  beacon.start();
  await binary.check();

  expect(binary.state.get().observation).toMatchObject({
    status: "inconclusive",
    reason: "missing-current-order",
  });
});

test("STORE-05 opening the store with the offer is accepted as a handoff, and installs nothing", async () => {
  const { beacon, binary, link } = create("3.2.0");

  beacon.start();
  await binary.check();

  const { observation } = binary.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await expect(
    binary.openStore({ offer: observation.offer.ref }),
  ).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "store-handoff-requested" },
  });
  expect(link.opened).toEqual([`https://apps.apple.com/app/id${APP_ID}`]);
  expect(binary.state.get().operation).toEqual({ state: "idle" });
});

test("opening the store needs no offer, so remediation can send a user there", async () => {
  const { beacon, binary, link } = create(null);

  beacon.start();

  await expect(binary.openStore()).resolves.toMatchObject({
    status: "accepted",
  });
  expect(link.opened).toHaveLength(1);
});

test("a store that cannot be opened is a failed command", async () => {
  const { beacon, binary, link } = create(null);

  link.fail(new Error("no handler"));
  beacon.start();

  await expect(binary.openStore()).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
});

test("a lookup that throws fails the check and keeps the last observation", async () => {
  const { beacon, binary, store } = create("3.2.0");

  beacon.start();
  await binary.check();

  const observed = binary.state.get().observation;

  store.fail(new Error("blocked"));

  await expect(binary.check()).resolves.toMatchObject({ status: "failed" });
  expect(binary.state.get().observation).toBe(observed);
});

test("STORE-01 a lookup that matched nothing is no offer in that storefront", async () => {
  const { beacon, binary, store } = create("3.2.0");

  store.publish([]);
  beacon.start();
  await binary.check();

  expect(binary.state.get().observation).toMatchObject({
    status: "none",
    reason: "no-decision",
    detail: "no-match",
  });
});

test("STORE-09 a build outside the store is offered nothing by it, and the store is never asked", async () => {
  const { beacon, binary, store } = create("3.2.0", "testflight");

  beacon.start();
  await binary.check();

  expect(binary.state.get().observation).toMatchObject({
    status: "none",
    reason: "no-decision",
    detail: "other-distribution",
  });
  expect(store.fetches).toEqual([]);
});

test("an ambiguous lookup fails the check as an invalid document, never resolved by guessing", async () => {
  const { beacon, binary, store } = create("3.2.0");

  store.publish([entry(), entry({ version: "3.4.0" })]);
  beacon.start();

  await expect(binary.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "INVALID_DOCUMENT" },
  });
});

test("STORE-06 a handoff that ends without an installation changes nothing about what runs or what is offered", async () => {
  const { beacon, binary } = create("3.2.0");

  beacon.start();
  await binary.check();

  const { observation } = binary.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  const running = beacon.running.get();

  await binary.openStore({ offer: observation.offer.ref });

  expect(beacon.running.get()).toEqual(running);
  expect(binary.state.get().observation).toEqual(observation);
  expect(binary.state.get().prepared).toEqual({ status: "not-applicable" });
  expect(beacon.support.get().status).toBe("unknown");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("STORE-09 opening the store in a build outside it is unsupported with no offer and no request, and opens nothing", async () => {
  const { beacon, binary, link, store } = create("3.2.0", "testflight");

  beacon.start();
  await binary.check();

  await expect(binary.openStore()).resolves.toEqual({
    status: "unsupported",
    reason: "other-distribution",
  });
  expect(link.opened).toEqual([]);
  expect(store.fetches).toEqual([]);
});

test("without a client of its own the route asks Apple's lookup through the global fetch, and offers what it answers", async () => {
  const asked: string[] = [];
  const link = fakeLinking();

  vi.stubGlobal("fetch", async (url: string) => {
    asked.push(url);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        resultCount: 1,
        results: [{ ...entry({ version: "3.4.0" }), artistName: "Example" }],
      }),
    };
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" }, native: () => nativeRelease("3.2.0") },
    routes: {
      binary: appStore({
        appId: APP_ID,
        country: "de",
        bundleId: BUNDLE_ID,
        linking: link.linking,
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();
  await beacon.route("binary").check();

  expect(asked).toEqual([
    `https://itunes.apple.com/lookup?id=${APP_ID}&country=de`,
  ]);
  expect(beacon.route("binary").state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { label: "3.4.0" } },
  });
});

test("a failing status of the default client fails the check and keeps the last observation", async () => {
  const link = fakeLinking();

  vi.stubGlobal("fetch", async () => ({
    ok: false,
    status: 429,
    json: async () => ({}),
  }));

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" }, native: () => nativeRelease("3.2.0") },
    routes: {
      binary: appStore({
        appId: APP_ID,
        country: "de",
        linking: link.linking,
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();

  await expect(beacon.route("binary").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
  expect(beacon.route("binary").state.get().observation).toMatchObject({
    status: "unknown",
  });
});

test("an id that is not a number, or a storefront that is not a country, is refused when the route is made", () => {
  const { linking } = fakeLinking();

  expect(() => appStore({ appId: "12a", country: "de", linking })).toThrow(
    expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
  );
  expect(() =>
    appStore({ appId: APP_ID, country: "Germany", linking }),
  ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
});

test("making the route and the beacon asks nothing and opens nothing", () => {
  const { binary, store, link } = create();

  expect(binary.state.get().observation).toMatchObject({ status: "unknown" });
  expect(store.fetches).toEqual([]);
  expect(link.opened).toEqual([]);
});
