import { BeaconError } from "@priemskiyyy/beacon";
import type { BeaconStatus } from "@priemskiyyy/beacon";
import { createEffect, createRoot, createSignal } from "solid-js";
import { expect, test, vi } from "vitest";

import { countListeners, createWebBeacon, target } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";
import { countBeacon } from "src/counted.fixture";
import { mountWithProvider } from "src/mount.fixture";
import { useBeacon } from "src/primitives/useBeacon";
import { useObservable } from "src/primitives/useObservable";
import { useRoute } from "src/primitives/useRoute";
import { useRunning } from "src/primitives/useRunning";
import { useStatus } from "src/primitives/useStatus";
import { useSupport } from "src/primitives/useSupport";
import { useTransitions } from "src/primitives/useTransitions";
import { settle } from "src/settle.fixture";

const answer = (context: ReturnType<typeof createWebBeacon>, build: string) => {
  context.mock.resolve({
    document: { web: target(build) },
    expiresAt: 601_000,
  });
};

// Checks the web route once and settles it with the given build.
const checkWith = async (
  context: ReturnType<typeof createWebBeacon>,
  build: string,
) => {
  const checking = context.beacon.route("web").check();

  await settle();
  answer(context, build);
  await checking;
};

// The tree every primitive below reads from, as an application publishes its Beacon once.
const mount = <TValue>(beacon: WebBeacon, read: () => TValue) =>
  mountWithProvider({ beacon: () => beacon }, read);

const expectMisuse = expect.objectContaining({
  name: "BeaconError",
  code: "INVALID_CONFIGURATION",
});

test("useRoute reads the route by name as it stands, and starts nothing", () => {
  const { beacon, mock } = createWebBeacon();
  const { value: route, dispose } = mount(beacon, () => useRoute("web"));

  expect(route()).toMatchObject({
    check: { state: "idle" },
    observation: { status: "unknown", reason: "not-checked" },
  });
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);

  dispose();
});

test("useRoute follows the offer once a check is accepted", async () => {
  const context = createWebBeacon();

  const { value: route, dispose } = mount(context.beacon, () =>
    useRoute("web"),
  );

  context.beacon.start();
  await checkWith(context, "web-build-a");

  expect(route().observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
  });

  dispose();
});

test("a route handle held outside a provider is read with useObservable", () => {
  const { beacon } = createWebBeacon();

  const { route, dispose } = createRoot((disposeRoot) => ({
    route: useObservable(beacon.route("web").state),
    dispose: disposeRoot,
  }));

  expect(route().observation).toMatchObject({ status: "unknown" });

  dispose();
});

test("BIND-06 useRoute with a selector runs what depends on it again only when the selection changes", async () => {
  const context = createWebBeacon();
  const seen: string[] = [];

  const { dispose } = mount(context.beacon, () => {
    const status = useRoute("web", ({ observation }) => observation.status);

    createEffect(() => {
      seen.push(status());
    });
  });

  expect(seen).toEqual(["unknown"]);

  context.beacon.start();
  await checkWith(context, "web-build-a");

  expect(seen).toEqual(["unknown", "available"]);

  await checkWith(context, "web-build-a");

  expect(seen).toEqual(["unknown", "available"]);

  dispose();
});

test("BIND-06 isEqual compares the selection, and an equal selection keeps the last one", async () => {
  const context = createWebBeacon();
  const runs = { fresh: 0, same: 0 };

  const select = ({ observation }: { observation: { status: string } }) => ({
    status: observation.status,
  });

  const { value: same, dispose } = mount(context.beacon, () => {
    const fresh = useRoute("web", select);

    const same = useRoute("web", select, {
      isEqual: (previous, next) => previous.status === next.status,
    });

    createEffect(() => {
      fresh();
      runs.fresh += 1;
    });

    createEffect(() => {
      same();
      runs.same += 1;
    });

    return same;
  });

  const first = same();
  const freshBefore = runs.fresh;

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();

  // The route is checking, and the observation is still unknown.
  expect(context.beacon.route("web").state.get().check.state).toBe("checking");
  expect(runs.fresh).toBeGreaterThan(freshBefore);
  expect(runs.same).toBe(1);
  expect(same()).toBe(first);

  answer(context, "web-build-a");
  await checking;

  expect(runs.same).toBe(2);
  expect(same()).toEqual({ status: "available" });

  dispose();
});

test("useObservable reads any observable of the Beacon, such as a route's native handle", () => {
  const { beacon } = createWebBeacon();

  beacon.start();

  const { native, dispose } = createRoot((disposeRoot) => ({
    native: useObservable(beacon.route("web").native),
    dispose: disposeRoot,
  }));

  expect(native()).toEqual({});

  dispose();
});

test("useObservable reads the observable as it was before any session until mounted, then subscribes, and lets go on dispose", () => {
  const { beacon } = createWebBeacon();
  const counted = countListeners(beacon.route("web").state);
  const during = { listeners: -1 };

  beacon.start();

  const { dispose, route } = createRoot((disposeRoot) => {
    const read = useObservable(counted.observable, ({ check }) => check.state);

    during.listeners = counted.listeners();

    return { dispose: disposeRoot, route: read };
  });

  expect(during.listeners).toBe(0);
  expect(counted.listeners()).toBe(1);
  expect(route()).toBe("idle");

  dispose();

  expect(counted.listeners()).toBe(0);
});

test("useRunning reads what is running, of the provider's Beacon", async () => {
  const { beacon } = createWebBeacon();

  const { value, dispose } = mount(beacon, () => ({
    all: useRunning(),
    web: useRunning(({ web }) => web.state),
  }));

  expect(value.all().web.state).toBe("pending");
  expect(value.web()).toBe("pending");

  beacon.start();
  await settle();

  expect(value.web()).toBe("known");
  expect(value.all().web.state).toBe("known");

  dispose();
});

test("useStatus reads where the session stands", () => {
  const { beacon } = createWebBeacon();

  const { value: state, dispose } = mount(beacon, () =>
    useStatus(({ state }) => state),
  );

  expect(state()).toBe("idle");

  const stop = beacon.start();

  expect(state()).toBe("running");

  stop();

  expect(state()).toBe("stopped");

  dispose();
});

test("useSupport reads support as it stands, which is unknown without a policy", () => {
  const { beacon } = createWebBeacon();

  const { value, dispose } = mount(beacon, () => ({
    support: useSupport(),
    status: useSupport(({ status }) => status),
  }));

  expect(value.support()).toMatchObject({
    status: "unknown",
    reason: "no-policy",
  });
  expect(value.status()).toBe("unknown");

  dispose();
});

test("useTransitions reads the journal as it stands, which is off without one, and follows a checkpoint", () => {
  const { beacon } = createWebBeacon();

  const { value, dispose } = mount(beacon, () => ({
    transitions: useTransitions(),
    checkpoints: useTransitions(({ checkpoints }) => checkpoints),
  }));

  expect(value.transitions()).toMatchObject({ journal: "off", latest: null });
  expect(value.checkpoints()).toEqual([]);

  beacon.reportReady({ checkpoint: "primary-screen" });

  expect(value.checkpoints()).toEqual(["primary-screen"]);

  dispose();
});

test("every read primitive subscribes once mounted and lets go on dispose", () => {
  const counted = countBeacon(createWebBeacon().beacon);
  const during = { listeners: counted.listeners() };

  const { dispose } = mount(counted.beacon, () => {
    useRoute("web");
    useRunning();
    useSupport();
    useTransitions();
    useStatus();
    during.listeners = counted.listeners();
  });

  // Nothing is held while the body runs, before the component is mounted.
  expect(during.listeners).toEqual({
    route: 0,
    status: 0,
    running: 0,
    support: 0,
    transitions: 0,
  });
  expect(counted.listeners()).toEqual({
    route: 1,
    status: 1,
    running: 1,
    support: 1,
    transitions: 1,
  });

  dispose();

  expect(counted.listeners()).toEqual({
    route: 0,
    status: 0,
    running: 0,
    support: 0,
    transitions: 0,
  });
});

test("a selector reads what it needs untracked, so another signal never resubscribes", () => {
  const { beacon } = createWebBeacon();
  const [suffix, setSuffix] = createSignal("a");

  const selector = vi.fn(({ state }: BeaconStatus) => `${state}-${suffix()}`);

  const { value: label, dispose } = mount(beacon, () => useStatus(selector));

  // Once for the initial value, and once for the live value on mount.
  expect(label()).toBe("idle-a");
  expect(selector).toHaveBeenCalledTimes(2);

  setSuffix("b");

  expect(selector).toHaveBeenCalledTimes(2);

  beacon.start();

  expect(label()).toBe("running-b");

  dispose();
});

test("BIND-08 the primitives read the provider's Beacon and follow a new one, without leaking a listener", async () => {
  const first = countBeacon(createWebBeacon().beacon);
  const second = countBeacon(createWebBeacon().beacon);
  const [beacon, setBeacon] = createSignal<WebBeacon>(first.beacon);

  second.beacon.start();
  await settle();

  const { value, dispose } = mountWithProvider({ beacon }, () => ({
    provided: useBeacon(),
    route: useRoute("web", ({ check }) => check.state),
    status: useStatus(({ state }) => state),
    running: useRunning(({ web }) => web.state),
    support: useSupport(({ status }) => status),
    transitions: useTransitions(({ journal }) => journal),
  }));

  expect(value.provided()).toBe(first.beacon);
  expect(value.status()).toBe("idle");
  expect(value.running()).toBe("pending");
  expect([first.listeners().status, second.listeners().status]).toEqual([1, 0]);

  setBeacon(second.beacon);

  expect(value.provided()).toBe(second.beacon);
  expect(value.status()).toBe("running");
  expect(value.running()).toBe("known");
  expect(first.listeners()).toEqual({
    route: 0,
    status: 0,
    running: 0,
    support: 0,
    transitions: 0,
  });
  expect(second.listeners()).toEqual({
    route: 1,
    status: 1,
    running: 1,
    support: 1,
    transitions: 1,
  });

  // What the first Beacon does no longer reaches the primitives.
  first.beacon.start();

  expect(value.status()).toBe("running");

  dispose();

  expect(second.listeners().status).toBe(0);
});

test("an effect that reads the provider's Beacon and a selection sees the new Beacon with its selection, never a mix", () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const [beacon, setBeacon] = createSignal<WebBeacon>(first.beacon);
  const seen: string[] = [];

  second.beacon.start();

  const { dispose } = mountWithProvider({ beacon }, () => {
    const provided = useBeacon();
    const state = useStatus(({ state }) => state);

    createEffect(() => {
      seen.push(`${provided().status.get().state}/${state()}`);
    });
  });

  expect(seen).toEqual(["idle/idle"]);

  setBeacon(second.beacon);

  expect(seen).toEqual(["idle/idle", "running/running"]);

  dispose();
});

test("useBeacon returns the provider's Beacon, and its commands are the Beacon's own", async () => {
  const { beacon } = createWebBeacon();

  const { value: provided, dispose } = mount(beacon, () => useBeacon());

  expect(provided()).toBe(beacon);

  beacon.start();

  await expect(provided().route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });

  dispose();
});

test("a primitive without a provider above it is misused, and says so as a BeaconError", () => {
  expect(() => createRoot(() => useBeacon())).toThrow(BeaconError);
  expect(() => createRoot(() => useBeacon())).toThrow(expectMisuse);
  expect(() => createRoot(() => useRunning())).toThrow(
    "useBeacon needs a BeaconProvider above it.",
  );
  expect(() => createRoot(() => useRoute("web"))).toThrow(expectMisuse);
  expect(() => createRoot(() => useSupport())).toThrow(expectMisuse);
  expect(() => createRoot(() => useTransitions())).toThrow(expectMisuse);
  expect(() => createRoot(() => useStatus())).toThrow(expectMisuse);
});
