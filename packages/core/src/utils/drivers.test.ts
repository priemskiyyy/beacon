import { expect, test } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import { createRoutedBeacon, settle } from "src/utils/Beacon.fixture";
import {
  BODY,
  createDriverBeacon,
  createFakeDriver,
} from "src/utils/drivers.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { target } from "src/utils/routes.fixture";
import { targetRoute } from "src/utils/targetRoute";
import type { Manifest } from "src/utils/routes.fixture";

const startWithOffer = async (
  context: ReturnType<typeof createDriverBeacon>,
) => {
  context.beacon.start();
  await context.ota.check();

  const { observation } = context.ota.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  return observation.offer.ref;
};

test("CORE-05 a prepared target and a new operation's progress stay distinguishable until the provider invalidates", async () => {
  const context = createDriverBeacon();
  const offer = await startWithOffer(context);

  context.emitter()?.prepared({ status: "ready", value: BODY });

  const downloading = context.ota.download({ offer });

  await settle();
  context.emitter()?.progress(0.5);

  expect(context.ota.state.get()).toMatchObject({
    prepared: { status: "ready" },
    operation: { state: "running", command: "download", progress: 0.5 },
  });

  context.emitter()?.prepared({ status: "none" });

  expect(context.ota.state.get()).toMatchObject({
    prepared: { status: "none" },
    operation: { state: "running", progress: 0.5 },
  });

  context.downloads[0]?.settleWith({
    status: "accepted",
    receipt: { kind: "downloaded" },
  });
  await downloading;
});

test("LIFE-04 a driver that fails to open leaves an unrelated route usable, and says which failed", async () => {
  const broken = createFakeDriver({ failOpen: new Error("no native module") });
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const events: string[] = [];

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "inert",
      open: () => ({ native: {} }),
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon({ ota: broken.route, web });

  beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.route}:${event.reason}`);
  });
  beacon.start();

  const checking = beacon.route("web").check();

  await settle();
  mock.resolve({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
    expiresAt: 601_000,
  });

  await expect(checking).resolves.toMatchObject({ status: "succeeded" });
  expect(beacon.route("ota").native.get()).toBeNull();
  expect(events).toContain("route-failed:ota:DRIVER_FAILED");
  await expect(beacon.route("ota").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
});

test("LIFE-05 a provider that reports while it opens is heard once, and starting again opens nothing more", async () => {
  const context = createDriverBeacon({
    emitOnOpen: { status: "available", offer: BODY },
  });

  const stop = context.beacon.start();

  expect(context.ota.state.get().observation).toMatchObject({
    status: "available",
  });
  expect(context.ota.state.get().revision).toBe(1);

  expect(context.beacon.start()).toBe(stop);
  expect(context.counts.opens).toBe(1);
});

test("a report that arrives after the session ended is dropped and counted", async () => {
  const context = createDriverBeacon();

  context.beacon.start();

  const emitter = context.emitter();

  context.beacon.stop();
  emitter?.observation({ status: "available", offer: BODY });

  expect(context.ota.state.get().observation).toMatchObject({
    status: "unknown",
  });
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(1);
});

test("LIFE-07 disposing while a provider operation continues leaves the outcome unknown, never cancelled", async () => {
  const context = createDriverBeacon();
  const offer = await startWithOffer(context);
  const downloading = context.ota.download({ offer });

  await settle();
  context.beacon.dispose();

  await expect(downloading).resolves.toMatchObject({
    status: "indeterminate",
    reason: "aborted-after-dispatch",
  });
  expect(context.downloads[0]?.signal.aborted).toBe(true);
});

test("LIFE-12 a handle kept after dispose reads a stable final snapshot and reopens nothing", async () => {
  const context = createDriverBeacon();

  await startWithOffer(context);

  const held = context.ota;
  const before = held.state.get();

  context.beacon.dispose();

  expect(held.state.get()).toBe(before);
  expect(held.native.get()).toBeNull();
  expect(held.state.subscribe(() => {})).toBeTypeOf("function");
  await expect(held.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DISPOSED" },
  });
  expect(context.counts.opens).toBe(1);
  expect(context.counts.disposals).toBe(1);
});

test("a provider's session is disposed once, and only the resources it made are its own", async () => {
  const context = createDriverBeacon();

  context.beacon.start();
  context.beacon.stop();
  context.beacon.start();
  context.beacon.stop();

  expect(context.counts).toEqual({ opens: 2, disposals: 2 });
  expect(context.native.label).toBe("fake provider");
});
