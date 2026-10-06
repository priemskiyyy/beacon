import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { expoBundle } from "src/expoBundle";
import { expoUpdates } from "src/expoUpdates";
import { createFakeUpdates } from "src/mock/createFakeUpdates";

const create = (options: Parameters<typeof createFakeUpdates>[0]) => {
  const updates = createFakeUpdates(options);

  const beacon = new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "ios",
      distribution: "app-store",
    },
    running: { boot: { id: "boot-1" }, bundle: expoBundle({ updates }) },
    routes: { ota: expoUpdates({ updates }) },
    clock: createTestClock({ now: 1_000 }),
  });

  return { updates, beacon, ota: beacon.route("ota") };
};

test("a fake with no options is a build with updates on and nothing to fetch, and asks for nothing until it is asked", async () => {
  const updates = createFakeUpdates();

  expect(updates.calls).toEqual({ checks: 0, fetches: 0, reloads: 0 });
  expect(updates.isEnabled).toBe(true);
  expect(updates.updateId).not.toBeNull();

  await expect(updates.checkForUpdateAsync()).resolves.toMatchObject({
    isAvailable: false,
    reason: "noUpdateAvailableOnServer",
  });
  await expect(updates.fetchUpdateAsync()).resolves.toMatchObject({
    isNew: false,
  });
  await expect(updates.reloadAsync()).resolves.toBeUndefined();
  expect(updates.calls).toEqual({ checks: 1, fetches: 1, reloads: 1 });
});

test("a fake with an update available offers it to a check and gives it to a fetch", async () => {
  const updates = createFakeUpdates({ available: true });
  const checked = await updates.checkForUpdateAsync();
  const fetched = await updates.fetchUpdateAsync();

  expect(checked).toMatchObject({ isAvailable: true });
  expect(fetched).toMatchObject({ isNew: true });
  expect(checked.manifest?.id).toBe(fetched.manifest?.id);
  expect(checked.manifest?.id).not.toBe(updates.updateId);
});

test("a fake with updates disabled is a build where they are off, and refuses each call the way the SDK does", async () => {
  const updates = createFakeUpdates({ disabled: true, available: true });

  expect(updates.isEnabled).toBe(false);
  expect(updates.updateId).toBeNull();

  await expect(updates.checkForUpdateAsync()).rejects.toMatchObject({
    code: "ERR_UPDATES_DISABLED",
  });
  await expect(updates.fetchUpdateAsync()).rejects.toMatchObject({
    code: "ERR_UPDATES_DISABLED",
  });
  await expect(updates.reloadAsync()).rejects.toMatchObject({
    code: "ERR_UPDATES_DISABLED",
  });
  expect(updates.calls).toEqual({ checks: 1, fetches: 1, reloads: 1 });
});

test("a Beacon over a fake with an update available offers it, downloads it and asks for a reload", async () => {
  const { updates, beacon, ota } = create({ available: true });

  beacon.start();
  await ota.check();

  const { observation } = ota.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await expect(
    ota.download({ offer: observation.offer.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "update-prepared", offered: "same" },
  });

  const { prepared } = ota.state.get();

  if (prepared.status !== "ready") {
    throw new Error("Nothing is prepared.");
  }

  await expect(
    ota.reload({ prepared: prepared.value.ref }),
  ).resolves.toMatchObject({ status: "accepted" });
  expect(updates.calls).toEqual({ checks: 1, fetches: 1, reloads: 1 });
});

test("a Beacon over a fake with no update says there is none, and the running bundle is the embedded one", async () => {
  const { beacon, ota } = create({});

  beacon.start();
  await beacon.check();

  expect(ota.state.get().observation).toMatchObject({
    status: "none",
    detail: "noUpdateAvailableOnServer",
  });
  expect(beacon.running.get().bundle).toMatchObject({
    state: "known",
    release: { identity: { status: "known", domain: "update" } },
  });
});

test("a Beacon over a fake with updates disabled is an environment that cannot check, as in a development build", async () => {
  const { updates, beacon, ota } = create({ disabled: true });

  beacon.start();
  await ota.check();

  expect(ota.state.get().observation).toMatchObject({
    status: "unknown",
    reason: "unsupported-environment",
  });
  expect(updates.calls).toEqual({ checks: 0, fetches: 0, reloads: 0 });
});

test("a method replaced on the fake is what the route meets, so a failure is scripted without a second fake", async () => {
  const { updates, beacon, ota } = create({ available: true });

  updates.fetchUpdateAsync = async () => {
    throw new Error("offline");
  };

  beacon.start();
  await ota.check();

  const { observation } = ota.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await expect(
    ota.download({ offer: observation.offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
});
