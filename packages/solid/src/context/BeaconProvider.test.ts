import { settle } from "@priemskiyyy/beacon/mock";
import { createComponent, createRoot, createSignal, onMount } from "solid-js";
import { expect, test } from "vitest";

import { createWebBeacon } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";
import { BeaconProvider } from "src/context/BeaconProvider";
import { mountWithProvider } from "src/mount.fixture";
import { useBeacon } from "src/primitives/useBeacon";

test("start false leaves the Beacon idle, for an application that starts the session itself, and checks nothing", async () => {
  const { beacon, mock } = createWebBeacon();

  const { dispose } = mountWithProvider(
    { beacon: () => beacon, start: () => false },
    () => {},
  );

  await settle();

  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);

  const stop = beacon.start();

  dispose();

  // Unmounting a provider that did not start the session does not end the one the application opened.
  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  stop();
});

test("start true says what the default says", () => {
  const { beacon } = createWebBeacon();

  const { dispose } = mountWithProvider(
    { beacon: () => beacon, start: () => true },
    () => {},
  );

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  dispose();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("the provider starts the session while mounted and ends it on unmount, without disposing the Beacon and with no prop asked for", () => {
  const { beacon, mock } = createWebBeacon();

  const { dispose } = mountWithProvider({ beacon: () => beacon }, () => {});

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });
  // Starting a session checks nothing.
  expect(mock.stats().reads).toBe(0);

  dispose();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  // The Beacon is the application's: it can still be started.
  beacon.start();

  expect(beacon.status.get()).toMatchObject({ state: "running" });
});

test("the provider's stop ends the session a scope replacement restarted", () => {
  const { beacon } = createWebBeacon();

  const { dispose } = mountWithProvider({ beacon: () => beacon }, () => {});

  beacon.replaceScope({
    application: "com.example.notes",
    environment: "staging",
    platform: "web",
    distribution: "public-web",
  });

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });

  dispose();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("a child that checks when it mounts finds the session already started", async () => {
  const { beacon } = createWebBeacon();
  const outcomes: string[] = [];

  const { dispose } = mountWithProvider({ beacon: () => beacon }, () => {
    onMount(() => {
      beacon.check().then(({ routes }) => outcomes.push(routes.web.status));
    });
  });

  await settle();

  expect(outcomes).not.toContain("failed");

  dispose();
});

test("BIND-07 a provider mounted, unmounted and mounted again leaves one session running with no check or command", () => {
  const { beacon, mock } = createWebBeacon();
  const props = { beacon: () => beacon };

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

  const { dispose } = mountWithProvider({ beacon }, () => {});

  expect(first.beacon.status.get()).toEqual({ state: "running", session: 1 });
  expect(second.beacon.status.get()).toEqual({ state: "idle" });

  setBeacon(second.beacon);

  expect(first.beacon.status.get()).toEqual({ state: "stopped" });
  expect(second.beacon.status.get()).toEqual({ state: "running", session: 1 });
  expect(second.mock.stats().reads).toBe(0);

  dispose();

  expect(second.beacon.status.get()).toEqual({ state: "stopped" });
});

test("what a listener reads while the provider starts the session does not restart it", async () => {
  const { beacon } = createWebBeacon();
  const [reads, setReads] = createSignal(0);
  const seen: number[] = [];

  const stop = beacon.status.subscribe(() => {
    seen.push(reads());
  });

  const { dispose } = mountWithProvider({ beacon: () => beacon }, () => {});

  expect(seen).toEqual([0]);

  setReads(1);
  await settle();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  dispose();
  stop();
});

test("the nearest provider publishes its Beacon to the tree below it", () => {
  const outer = createWebBeacon().beacon;
  const inner = createWebBeacon().beacon;

  const read = createRoot((dispose) => {
    const seen: Array<WebBeacon> = [];

    createComponent(BeaconProvider, {
      beacon: outer,
      start: false,
      get children() {
        seen.push(useBeacon()());

        createComponent(BeaconProvider, {
          beacon: inner,
          start: false,
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
