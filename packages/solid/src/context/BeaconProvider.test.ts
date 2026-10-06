import { createComponent, createRoot, createSignal, onMount } from "solid-js";
import { expect, test } from "vitest";

import { createWebBeacon } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";
import { BeaconProvider } from "src/context/BeaconProvider";
import { mountWithProvider } from "src/mount.fixture";
import { useBeacon } from "src/primitives/useBeacon";
import { settle } from "src/settle.fixture";

test("the provider without start leaves the Beacon idle, and checks nothing", async () => {
  const { beacon, mock } = createWebBeacon();

  const { dispose } = mountWithProvider({ beacon: () => beacon }, () => {});

  await settle();

  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);

  dispose();

  expect(beacon.status.get()).toEqual({ state: "idle" });
});

test("the provider starts the session while mounted and ends it on unmount, without disposing the Beacon", () => {
  const { beacon } = createWebBeacon();

  const { dispose } = mountWithProvider(
    { beacon: () => beacon, start: () => true },
    () => {},
  );

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  dispose();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  // The Beacon is the application's: it can still be started.
  beacon.start();

  expect(beacon.status.get()).toMatchObject({ state: "running" });
});

test("a child that checks when it mounts finds the session already started", async () => {
  const { beacon } = createWebBeacon();
  const outcomes: string[] = [];

  const { dispose } = mountWithProvider(
    { beacon: () => beacon, start: () => true },
    () => {
      onMount(() => {
        beacon.check().then(({ routes }) => outcomes.push(routes.web.status));
      });
    },
  );

  await settle();

  expect(outcomes).not.toContain("failed");

  dispose();
});

test("BIND-07 a provider mounted, unmounted and mounted again leaves one session running with no check or command", () => {
  const { beacon, mock } = createWebBeacon();
  const props = { beacon: () => beacon, start: () => true };

  mountWithProvider(props, () => {}).dispose();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  const { dispose } = mountWithProvider(props, () => {});

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
  expect(mock.stats().reads).toBe(0);

  dispose();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("the provider follows start: it holds the session only while start is true", () => {
  const { beacon } = createWebBeacon();
  const [start, setStart] = createSignal(false);

  const { dispose } = mountWithProvider(
    { beacon: () => beacon, start },
    () => {},
  );

  expect(beacon.status.get()).toEqual({ state: "idle" });

  setStart(true);

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  setStart(false);

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  setStart(true);

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });

  dispose();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("the provider follows a new beacon: the old session ends and a new one starts", () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const [beacon, setBeacon] = createSignal<WebBeacon>(first.beacon);

  const { dispose } = mountWithProvider(
    { beacon, start: () => true },
    () => {},
  );

  expect(first.beacon.status.get()).toEqual({ state: "running", session: 1 });
  expect(second.beacon.status.get()).toEqual({ state: "idle" });

  setBeacon(second.beacon);

  expect(first.beacon.status.get()).toEqual({ state: "stopped" });
  expect(second.beacon.status.get()).toEqual({ state: "running", session: 1 });
  expect(second.mock.stats().reads).toBe(0);

  dispose();

  expect(second.beacon.status.get()).toEqual({ state: "stopped" });
});

test("the nearest provider publishes its Beacon to the tree below it", () => {
  const outer = createWebBeacon().beacon;
  const inner = createWebBeacon().beacon;

  const read = createRoot((dispose) => {
    const seen: Array<WebBeacon> = [];

    createComponent(BeaconProvider, {
      beacon: outer,
      get children() {
        seen.push(useBeacon()());

        createComponent(BeaconProvider, {
          beacon: inner,
          get children() {
            seen.push(useBeacon()());

            return undefined;
          },
        });

        return undefined;
      },
    });

    return { seen, dispose };
  });

  expect(read.seen[0]).toBe(outer);
  expect(read.seen[1]).toBe(inner);
  expect(outer.status.get()).toEqual({ state: "idle" });

  read.dispose();
});
