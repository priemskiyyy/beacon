import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { expoBundle } from "src/expoBundle";
import { expoUpdates } from "src/expoUpdates";
import {
  available,
  fakeUpdates,
  fetchedNew,
  fetchedNothing,
  fetchedRollback,
  notAvailable,
  rollbackCheck,
  UPDATE_A,
  UPDATE_B,
} from "src/fakeUpdates.fixture";

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "ios",
  distribution: "app-store",
};

// Lets every queued promise continuation run before the test goes on.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const create = (options: Parameters<typeof fakeUpdates>[0] = {}) => {
  const fake = fakeUpdates(options);

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" }, bundle: expoBundle(fake.updates) },
    routes: { ota: expoUpdates({ updates: fake.updates }) },
    clock: createTestClock({ now: 1_000 }),
  });

  return { ...fake, beacon, ota: beacon.route("ota") };
};

const checkOffer = async (context: ReturnType<typeof create>) => {
  context.beacon.start();
  await context.ota.check();

  const { observation } = context.ota.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  return observation.offer;
};

test("creating the route and the beacon call the SDK not at all", () => {
  const { calls } = create();

  expect(calls).toEqual({ checks: 0, fetches: 0, reloads: 0 });
});

test("a check reports an available update as an offer, and downloads nothing", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));

  const offer = await checkOffer(context);

  expect(offer).toMatchObject({
    kind: "update",
    release: { identity: { value: UPDATE_A } },
  });
  expect(context.calls).toEqual({ checks: 1, fetches: 0, reloads: 0 });
  expect(context.ota.state.get().prepared).toEqual({ status: "unknown" });
});

test("a rollback directive is an actionable offer, not no update", async () => {
  const context = create();

  context.willCheck(rollbackCheck());

  await expect(checkOffer(context)).resolves.toMatchObject({
    kind: "rollback-to-embedded",
  });
});

test("a valid check with nothing to offer is no offer with the SDK's reason", async () => {
  const context = create();

  context.willCheck(notAvailable("noUpdateAvailableOnServer"));
  context.beacon.start();
  await context.ota.check();

  expect(context.ota.state.get().observation).toMatchObject({
    status: "none",
    detail: "noUpdateAvailableOnServer",
  });
});

test("EXPO-04 a rejected check fails the check and keeps what was observed", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));

  const offer = await checkOffer(context);

  context.willCheck(new Error("timeout"));

  await expect(context.ota.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
  expect(context.ota.state.get().observation).toMatchObject({
    status: "available",
    offer: { ref: offer.ref },
  });
});

test("disabled updates are an environment that cannot check, never no update", async () => {
  const context = create({ isEnabled: false, updateId: null });

  context.beacon.start();
  await context.ota.check();

  expect(context.ota.state.get().observation).toEqual({
    status: "unknown",
    reason: "unsupported-environment",
  });
  expect(context.calls.checks).toBe(0);
});

test("EXPO-05 downloading prepares the update the provider chose, and says it is the one offered", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));

  const offer = await checkOffer(context);

  await expect(context.ota.download({ offer: offer.ref })).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: {
      kind: "update-prepared",
      update: { id: UPDATE_A },
      offered: "same",
    },
  });
  expect(context.ota.state.get().prepared).toMatchObject({
    status: "ready",
    value: { kind: "update", release: { identity: { value: UPDATE_A } } },
  });
  expect(context.ota.state.get().operation).toEqual({ state: "idle" });
});

test("EXPO-08 a different update than the one offered is reported as different, with a prepared reference of its own", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_B));

  const offer = await checkOffer(context);
  const outcome = await context.ota.download({ offer: offer.ref });

  expect(outcome).toMatchObject({
    status: "accepted",
    receipt: {
      kind: "update-prepared",
      update: { id: UPDATE_B },
      offered: "different",
    },
  });
  expect(context.ota.state.get().prepared).toMatchObject({
    status: "ready",
    value: { release: { identity: { value: UPDATE_B } } },
  });
});

test("EXPO-07 a valid download that is not new prepares nothing and leaves what was known", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNothing());

  const offer = await checkOffer(context);

  await expect(
    context.ota.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "no-new-preparation" },
  });
  expect(context.ota.state.get().prepared).toEqual({ status: "unknown" });
});

test("EXPO-06 a rollback download is prepared as a rollback", async () => {
  const context = create();

  context.willCheck(rollbackCheck());
  context.willFetch(fetchedRollback());

  const offer = await checkOffer(context);

  await expect(
    context.ota.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    receipt: { kind: "rollback-prepared", offered: "unknown" },
  });
  expect(context.ota.state.get().prepared).toMatchObject({
    status: "ready",
    value: { kind: "rollback-to-embedded" },
  });
});

test("a download that fails is a failed command, and prepares nothing", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(new Error("network lost"));

  const offer = await checkOffer(context);

  await expect(
    context.ota.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.ota.state.get().prepared).toEqual({ status: "unknown" });
});

test("EXPO-10 a downloaded update survives a check that fails", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));

  const offer = await checkOffer(context);

  await context.ota.download({ offer: offer.ref });

  const { prepared } = context.ota.state.get();

  context.willCheck(new Error("offline"));
  await context.ota.check();

  expect(context.ota.state.get().prepared).toBe(prepared);
});

test("downloading may activate on the next start, which the route declares before the user agrees", () => {
  const { ota } = create();

  expect(ota.capabilities.download).toEqual({
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
  });
  expect(ota.capabilities.requestReload).toEqual({
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "provider-current",
  });
});

test("EXPO-18 a reload restarts the runtime, and the route is unresolved until the application acknowledges", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));

  const offer = await checkOffer(context);

  await context.ota.download({ offer: offer.ref });

  const { prepared } = context.ota.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  await expect(
    context.ota.requestReload({ prepared: prepared.value.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  expect(context.calls.reloads).toBe(1);
  expect(context.ota.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "dispatch-unconfirmed",
  });
});

test("a reload the SDK rejects is a failed command", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));
  context.willReload(new Error("no runtime"));

  const offer = await checkOffer(context);

  await context.ota.download({ offer: offer.ref });

  const { prepared } = context.ota.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  await expect(
    context.ota.requestReload({ prepared: prepared.value.ref }),
  ).resolves.toMatchObject({
    status: "failed",
  });
  expect(context.ota.state.get().operation).toEqual({ state: "idle" });
});

test("a command in an environment with updates disabled is unsupported", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));

  const offer = await checkOffer(context);

  context.updates.isEnabled = false;

  await expect(context.ota.download({ offer: offer.ref })).resolves.toEqual({
    status: "unsupported",
    reason: "updates-disabled",
  });
  expect(context.calls.fetches).toBe(0);
});

test("the running bundle is read from the constants, and never written by the route", async () => {
  const context = create();

  context.beacon.start();
  await settle();

  expect(context.beacon.running.get().bundle).toMatchObject({
    state: "known",
    release: { identity: { value: "00000000-0000-4000-8000-000000000001" } },
  });
});

test("the native handle is the injected module while a session runs", () => {
  const context = create();

  expect(context.ota.native.get()).toBeNull();

  context.beacon.start();

  expect(context.ota.native.get()?.updates).toBe(context.updates);
});

test("a download after the session ended reports nothing to the route", async () => {
  const context = create();

  context.willCheck(available(UPDATE_A));
  context.willFetch(fetchedNew(UPDATE_A));

  const offer = await checkOffer(context);
  const before = context.ota.state.get();

  context.beacon.stop();

  await expect(
    context.ota.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "NOT_STARTED" },
  });
  expect(context.ota.state.get()).toBe(before);
});
