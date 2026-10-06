import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { applyUpdate } from "src/applyUpdate";
import { expoBundle } from "src/expoBundle";
import { expoUpdates } from "src/expoUpdates";
import {
  available,
  fakeUpdates,
  fetchedNew,
  fetchedNothing,
  notAvailable,
  UPDATE_A,
  UPDATE_B,
} from "src/fakeUpdates.fixture";

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "ios",
  distribution: "app-store",
};

const create = () => {
  const fake = fakeUpdates();

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      bundle: expoBundle({ updates: fake.updates }),
    },
    routes: { ota: expoUpdates({ updates: fake.updates }) },
    clock: createTestClock({ now: 1_000 }),
  });

  return { ...fake, beacon, ota: beacon.route("ota") };
};

const checkOffer = async (context: ReturnType<typeof create>) => {
  context.beacon.start();
  await context.ota.check();
};

test("an update on offer is downloaded and then reloaded, and both outcomes are given", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));
  await checkOffer(context);

  const applied = await applyUpdate(context.ota);

  expect(applied).toMatchObject({
    step: "reload",
    outcome: { status: "accepted", receipt: { kind: "reload-requested" } },
    download: {
      status: "accepted",
      receipt: { kind: "update-prepared", offered: "same" },
    },
  });
  expect(context.calls).toEqual({ checks: 1, fetches: 1, reloads: 1 });
});

test("a download that prepared another update than the one on offer says so, and is still reloaded", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_B));
  await checkOffer(context);

  await expect(applyUpdate(context.ota)).resolves.toMatchObject({
    step: "reload",
    download: {
      status: "accepted",
      receipt: { kind: "update-prepared", offered: "different" },
    },
  });
});

test("an accepted reload leaves the route unresolved, so a second call reloads nothing again", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));
  await checkOffer(context);
  await applyUpdate(context.ota);

  const again = await applyUpdate(context.ota);

  expect(again).toMatchObject({
    step: "download",
    outcome: { status: "blocked" },
  });
  expect(context.calls).toEqual({ checks: 1, fetches: 1, reloads: 1 });
});

test("with nothing on offer and nothing prepared nothing is asked of the SDK", async () => {
  const context = create();

  context.willCheck(notAvailable("noUpdateAvailableOnServer"));
  await checkOffer(context);

  await expect(applyUpdate(context.ota)).resolves.toEqual({ step: "none" });
  expect(context.calls).toEqual({ checks: 1, fetches: 0, reloads: 0 });
});

test("before the session starts there is nothing on offer, and nothing is asked", async () => {
  const context = create();

  await expect(applyUpdate(context.ota)).resolves.toEqual({ step: "none" });
  expect(context.calls).toEqual({ checks: 0, fetches: 0, reloads: 0 });
});

test("a download the SDK rejects stops at the download, with its failure, and reloads nothing", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(new Error("offline"));
  await checkOffer(context);

  await expect(applyUpdate(context.ota)).resolves.toMatchObject({
    step: "download",
    outcome: { status: "failed", error: { code: "COMMAND_FAILED" } },
  });
  expect(context.calls.reloads).toBe(0);
});

test("a download that prepared nothing new stops at the download, accepted, and reloads nothing", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNothing());
  await checkOffer(context);

  await expect(applyUpdate(context.ota)).resolves.toMatchObject({
    step: "download",
    outcome: { status: "accepted", receipt: { kind: "no-new-preparation" } },
  });
  expect(context.calls.reloads).toBe(0);
});

test("a participant that blocks the restart is the outcome of the reload, after a download that was accepted", async () => {
  const context = create();

  context.beacon.disruptions.register({
    name: "draft",
    impacts: ["javascript-restart"],
    reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
  });
  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));
  await checkOffer(context);

  const applied = await applyUpdate(context.ota);

  expect(applied).toMatchObject({
    step: "reload",
    outcome: { status: "blocked", reasons: [{ code: "unsaved-draft" }] },
    download: { status: "accepted" },
  });
  expect(context.calls).toEqual({ checks: 1, fetches: 1, reloads: 0 });
});

test("a reload the SDK rejects is a failed outcome of the reload, never a throw", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));
  context.willReload(new Error("no native module"));
  await checkOffer(context);

  await expect(applyUpdate(context.ota)).resolves.toMatchObject({
    step: "reload",
    outcome: { status: "failed", error: { code: "COMMAND_FAILED" } },
    download: { status: "accepted" },
  });
});

test("an update downloaded earlier is reloaded without a download when nothing is on offer any more", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));
  await checkOffer(context);

  const { observation } = context.ota.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await context.ota.download({ offer: observation.offer.ref });
  context.willCheck(notAvailable("noUpdateAvailableOnServer"));
  await context.ota.check();

  expect(context.ota.state.get().observation.status).toBe("none");
  expect(context.ota.state.get().prepared.status).toBe("ready");

  await expect(applyUpdate(context.ota)).resolves.toMatchObject({
    step: "reload",
    outcome: { status: "accepted" },
    download: null,
  });
  expect(context.calls).toEqual({ checks: 2, fetches: 1, reloads: 1 });
});

test("a route whose updates are disabled has no offer, so nothing is applied", async () => {
  const fake = fakeUpdates({ isEnabled: false, updateId: null });

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes: { ota: expoUpdates({ updates: fake.updates }) },
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();
  await beacon.check();

  await expect(applyUpdate(beacon.route("ota"))).resolves.toEqual({
    step: "none",
  });
  expect(fake.calls).toEqual({ checks: 0, fetches: 0, reloads: 0 });
});
