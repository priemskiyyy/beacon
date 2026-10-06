import {
  Beacon,
  createUpdateMechanism,
  targetRoute,
} from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { fakeBackend, SCOPE } from "src/fakeBackend.fixture";
import { http } from "src/http";

const createWebBeacon = () => {
  const backend = fakeBackend();
  const clock = createTestClock({ now: 1_000 });
  const manifest = http({ name: "manifest", fetch: backend.fetch });

  const web = targetRoute({
    source: manifest.select((document) => document.web),
    mechanism: createUpdateMechanism({
      name: "inert",
      subject: "web",
      open: () => ({ native: {} }),
      commands: {},
    }),
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => ({
        identity: {
          status: "known",
          authority: "com.example.notes",
          domain: "web-artifact",
          value: "web-build-b",
        },
        label: "Build web-build-b",
        raw: {},
      }),
    },
    routes: { web },
    clock,
  });

  return { backend, beacon, clock };
};

test("a checked manifest is an offer whose evidence names the source and its revision", async () => {
  const { beacon } = createWebBeacon();

  beacon.start();

  await expect(beacon.route("web").check()).resolves.toMatchObject({
    status: "succeeded",
  });

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
    evidence: {
      source: "manifest",
      origin: "network",
      issuer: "release-service",
      expiresAt: 601_000,
      revision: { kind: "ordered", value: "208" },
    },
  });
});

test("a not modified answer renews the offer the user was shown and moves its expiry", async () => {
  const { backend, beacon } = createWebBeacon();
  const web = beacon.route("web");

  beacon.start();
  await web.check();

  const shown = web.state.get().observation;

  backend.state.expiresAt = 1_201_000;
  await web.check();

  const renewed = web.state.get().observation;

  if (shown.status !== "available" || renewed.status !== "available") {
    throw new Error("The route has no offer.");
  }

  expect(renewed.offer.ref).toBe(shown.offer.ref);
  expect(renewed.evidence).toMatchObject({
    expiresAt: 1_201_000,
    freshness: "fresh",
  });
  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    '"208"',
  ]);
});

test("the validator outlives a stop and a start, as the document the core keeps does", async () => {
  const { backend, beacon } = createWebBeacon();
  const web = beacon.route("web");

  beacon.start();
  await web.check();
  beacon.stop();
  beacon.start();
  await web.check();

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    '"208"',
  ]);
});

test("HTTP-02 a scope replaced for another account is read without the validator of the first", async () => {
  const { backend, beacon } = createWebBeacon();
  const web = beacon.route("web");

  beacon.start();
  await web.check();

  expect(beacon.replaceScope({ ...SCOPE, partition: "alice" })).toEqual({
    status: "replaced",
  });

  await web.check();
  await web.check();

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    null,
    '"208"',
  ]);

  expect(backend.fetches.map((context) => context.scope.partition)).toEqual([
    undefined,
    "alice",
    "alice",
  ]);
});

test("a scope replaced by an equal one changes nothing, so the validator stays", async () => {
  const { backend, beacon } = createWebBeacon();
  const web = beacon.route("web");

  beacon.start();
  await web.check();

  expect(beacon.replaceScope({ ...SCOPE })).toEqual({ status: "unchanged" });

  await web.check();

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    '"208"',
  ]);
});

test("a client that throws an ordinary error fails the check as a source failure, and keeps what was accepted", async () => {
  const { backend, beacon } = createWebBeacon();
  const web = beacon.route("web");

  beacon.start();
  await web.check();

  const accepted = web.state.get().observation;

  backend.state.failure = new Error("offline");

  await expect(web.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });

  expect(web.state.get().observation).toEqual(accepted);
});
