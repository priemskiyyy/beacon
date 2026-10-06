import { Beacon, newerRoute } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import type { ReleaseScope, RunningRelease } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { appleMarketingVersion } from "src/appleMarketingVersion";
import { appleVersion } from "src/appleVersion";
import { appStoreHandoff } from "src/appStoreHandoff";
import { appStoreLookup } from "src/appStoreLookup";
import {
  APP_ID,
  BUNDLE_ID,
  entry,
  fakeLinking,
  fakeStore,
} from "src/fakeStore.fixture";

const SCOPE: ReleaseScope = {
  application: BUNDLE_ID,
  environment: "production",
  platform: "ios",
  distribution: "app-store",
};

const nativeRelease = (shortVersion: string | null): RunningRelease => ({
  identity: {
    status: "known",
    authority: BUNDLE_ID,
    domain: "ios-build",
    value: "412",
  },
  label: null,
  raw:
    shortVersion === null ? { build: "412" } : { shortVersion, build: "412" },
});

const create = (running: string | null = "3.2.0") => {
  const store = fakeStore();
  const link = fakeLinking();

  const lookup = appStoreLookup({
    appId: APP_ID,
    country: "de",
    bundleId: BUNDLE_ID,
    request: store.request,
  });

  const binary = newerRoute({
    subject: "native",
    source: lookup.select((document) => document.decision),
    version: appleVersion(),
    current: appleMarketingVersion,
    mechanism: appStoreHandoff({ appId: APP_ID, linking: link.linking }),
  });

  const beacon = new Beacon({
    scope: SCOPE,
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
    receipt: { kind: "store-handoff-accepted" },
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

test("an ambiguous lookup fails the check as a source failure, never resolved by guessing", async () => {
  const { beacon, binary, store } = create("3.2.0");

  store.publish([entry(), entry({ version: "3.4.0" })]);
  beacon.start();

  await expect(binary.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
});
