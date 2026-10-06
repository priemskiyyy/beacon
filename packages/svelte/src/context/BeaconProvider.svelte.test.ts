import { settle } from "@priemskiyyy/beacon/mock";
import { cleanup, render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, expect, test } from "vitest";
import { createWebBeacon } from "../beacon.fixture.js";
import { mountView } from "../utilities/mountView.fixture.js";
import { useBeacon } from "../utilities/useBeacon.js";
import { useBeaconStatus } from "../utilities/useBeaconStatus.js";
import BeaconProvider from "./BeaconProvider.svelte";
import CheckerHarness from "./CheckerHarness.fixture.svelte";

afterEach(cleanup);

test("the provider starts the session while mounted and ends it on unmount, with no prop asked for", () => {
  const { beacon, mock } = createWebBeacon();

  const { unmount } = render(BeaconProvider, { props: { beacon } });

  flushSync();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });
  // Starting a session checks nothing.
  expect(mock.stats().reads).toBe(0);

  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("start true says what the default says", () => {
  const { beacon } = createWebBeacon();

  const { unmount } = render(BeaconProvider, {
    props: { beacon, start: true },
  });

  flushSync();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("the provider's stop ends the session a scope replacement restarted", () => {
  const { beacon } = createWebBeacon();

  const { unmount } = render(BeaconProvider, { props: { beacon } });

  flushSync();
  beacon.replaceScope({
    application: "com.example.notes",
    environment: "staging",
    platform: "web",
    distribution: "public-web",
  });

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });

  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("a child that checks when it mounts finds the session already started", async () => {
  const { beacon } = createWebBeacon();
  const outcomes: string[] = [];

  render(CheckerHarness, { props: { beacon, outcomes } });
  flushSync();
  await settle();

  expect(outcomes).not.toContain("failed");
});

test("start false leaves the Beacon idle, for an application that starts the session itself, and its unmount ends nothing", () => {
  const { beacon } = createWebBeacon();

  const { unmount } = render(BeaconProvider, {
    props: { beacon, start: false },
  });

  flushSync();

  expect(beacon.status.get()).toEqual({ state: "idle" });

  const stop = beacon.start();

  unmount();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  stop();
});

test("the provider publishes its Beacon to the components below and renders them", () => {
  const { beacon } = createWebBeacon();
  const { value, container } = mountView(beacon, () => useBeacon());

  expect(value.current).toBe(beacon);
  expect(container.textContent).toBe("");
});

test("BIND-07 a provider that mounts again starts a new session and leaves one running, with no check or command", () => {
  const { beacon, mock } = createWebBeacon();

  const first = render(BeaconProvider, { props: { beacon } });

  flushSync();
  first.unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  render(BeaconProvider, { props: { beacon } });
  flushSync();

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
  expect(mock.stats().reads).toBe(0);
});

test("a provider whose start changes ends the session or starts a new one", async () => {
  const { beacon } = createWebBeacon();
  const view = render(BeaconProvider, { props: { beacon } });

  flushSync();

  await view.rerender({ start: false });
  flushSync();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  await view.rerender({ start: true });
  flushSync();

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });

  await view.rerender({ start: false });
  flushSync();

  // A start that is undefined is the default, which starts.
  await view.rerender({ start: undefined });
  flushSync();

  expect(beacon.status.get()).toEqual({ state: "running", session: 3 });
});

test("a provider whose Beacon changes ends the old session and starts one on the new Beacon", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  const view = render(BeaconProvider, { props: { beacon: first.beacon } });

  flushSync();

  await view.rerender({ beacon: second.beacon });
  flushSync();

  expect(first.beacon.status.get()).toEqual({ state: "stopped" });
  expect(second.beacon.status.get()).toEqual({ state: "running", session: 1 });
});

test("unmounting the provider ends its session and disposes nothing", async () => {
  const { beacon } = createWebBeacon();

  const { unmount } = render(BeaconProvider, { props: { beacon } });

  flushSync();
  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  const stop = beacon.start();

  await settle();

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
  stop();
});

test("what a listener reads while the provider starts the session does not restart it", async () => {
  const { beacon } = createWebBeacon();
  let reads = $state(0);
  const seen: number[] = [];

  const stop = beacon.status.subscribe(() => {
    seen.push(reads);
  });

  mountView(beacon, () => useBeaconStatus(), { start: true });

  expect(seen).toEqual([0]);

  reads = 1;
  flushSync();
  await settle();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });
  stop();
});
