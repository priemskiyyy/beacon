import { BeaconError } from "@priemskiyyy/beacon";
import { cleanup, render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, expect, test } from "vitest";
import {
  countListeners,
  createWebBeacon,
  settle,
  target,
} from "../beacon.fixture.js";
import { mountBareView } from "./mountBareView.fixture.js";
import { mountView } from "./mountView.fixture.js";
import { useBeacon } from "./useBeacon.js";
import { useObservable } from "./useObservable.js";
import { useRoute } from "./useRoute.js";
import { useRunning } from "./useRunning.js";
import { useStatus } from "./useStatus.js";
import { useSupport } from "./useSupport.js";
import { useTransitions } from "./useTransitions.js";
import View from "./View.fixture.svelte";

afterEach(cleanup);

const answer = (context: ReturnType<typeof createWebBeacon>, build: string) => {
  context.mock.resolve({
    document: { web: target(build) },
    expiresAt: 601_000,
  });
};

// A check that the web manifest answers with one build.
const check = async (
  context: ReturnType<typeof createWebBeacon>,
  build: string,
) => {
  const checking = context.beacon.route("web").check();

  await settle();
  answer(context, build);
  await checking;
};

test("useRoute reads the route by name as it stands, and starts nothing", () => {
  const { beacon, mock } = createWebBeacon();
  const { value } = mountView(beacon, () => useRoute("web"));

  expect(value.current).toMatchObject({
    check: { state: "idle" },
    observation: { status: "unknown", reason: "not-checked" },
  });
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
});

test("useRoute follows the offer once a check is accepted", async () => {
  const context = createWebBeacon();
  const { value } = mountView(context.beacon, () => useRoute("web"));

  context.beacon.start();
  await check(context, "web-build-a");

  expect(value.current.observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
  });
});

test("a route handle held outside a provider is read with useObservable", () => {
  const { beacon } = createWebBeacon();

  const { value } = mountBareView(() =>
    useObservable(beacon.route("web").state),
  );

  expect(value.current.observation).toMatchObject({ status: "unknown" });
});

test("BIND-06 useRoute with a selector runs its dependents again only when the selection changes", async () => {
  const context = createWebBeacon();
  const runs: string[] = [];

  const { value } = mountView(context.beacon, () => {
    const status = useRoute("web", ({ observation }) => observation.status);

    $effect(() => {
      runs.push(status.current);
    });

    return status;
  });

  expect(value.current).toBe("unknown");

  context.beacon.start();
  await check(context, "web-build-a");
  flushSync();

  expect(value.current).toBe("available");
  expect(runs).toEqual(["unknown", "available"]);

  await check(context, "web-build-a");
  flushSync();

  expect(runs).toEqual(["unknown", "available"]);
});

test("an isEqual option compares the selected type, and an equal selection keeps its reference", async () => {
  const context = createWebBeacon();
  const runs: { status: string }[] = [];

  const { value } = mountView(context.beacon, () => {
    const status = useRoute(
      "web",
      ({ observation }) => ({ status: observation.status }),
      { isEqual: (previous, next) => previous.status === next.status },
    );

    $effect(() => {
      runs.push(status.current);
    });

    return status;
  });

  const initial = value.current;

  expect(initial).toEqual({ status: "unknown" });

  context.beacon.start();
  await check(context, "web-build-a");
  flushSync();

  const available = value.current;

  expect(available).toEqual({ status: "available" });

  await check(context, "web-build-a");
  flushSync();

  expect(value.current).toBe(available);
  expect(runs).toEqual([initial, available]);
});

test("without isEqual a new object each time runs its dependents again, which is why isEqual exists", async () => {
  const context = createWebBeacon();
  const runs: { status: string }[] = [];

  mountView(context.beacon, () => {
    const status = useRoute("web", ({ observation }) => ({
      status: observation.status,
    }));

    $effect(() => {
      runs.push(status.current);
    });

    return status;
  });

  context.beacon.start();
  await check(context, "web-build-a");
  flushSync();

  expect(runs.length).toBeGreaterThan(2);
});

test("useObservable subscribes once mounted and lets go on unmount", () => {
  const { beacon } = createWebBeacon();
  const counted = countListeners(beacon.route("web").state);
  const before: number[] = [];

  const { unmount } = mountView(beacon, () => {
    const state = useObservable(counted.observable);

    before.push(counted.listeners());

    return state;
  });

  // Effects run after the component initialized, so nothing is subscribed before it is mounted.
  expect(before).toEqual([0]);
  expect(counted.listeners()).toBe(1);

  unmount();

  expect(counted.listeners()).toBe(0);
});

test("useObservable reads any observable of the Beacon, such as a route's native handle", () => {
  const { beacon } = createWebBeacon();

  beacon.start();

  const { value } = mountView(beacon, () =>
    useObservable(beacon.route("web").native),
  );

  expect(value.current).toEqual({});
});

test("useRunning reads what is running, of the provider's Beacon", async () => {
  const { beacon } = createWebBeacon();
  const all = mountView(beacon, () => useRunning());
  const web = mountView(beacon, () => useRunning(({ web }) => web.state));

  expect(all.value.current.web.state).toBe("pending");
  expect(web.value.current).toBe("pending");

  beacon.start();
  await settle();

  expect(web.value.current).toBe("known");
  expect(all.value.current.web.state).toBe("known");
});

test("useStatus reads where the session stands", () => {
  const { beacon } = createWebBeacon();
  const { value } = mountView(beacon, () => useStatus(({ state }) => state));

  expect(value.current).toBe("idle");

  beacon.start();

  expect(value.current).toBe("running");
});

test("useSupport reads support as it stands, which is unknown without a policy", () => {
  const { beacon } = createWebBeacon();
  const { value } = mountView(beacon, () => useSupport());

  expect(value.current).toMatchObject({
    status: "unknown",
    reason: "no-policy",
  });
});

test("useSupport with a selector reads the selection of the provider's Beacon", () => {
  const { beacon } = createWebBeacon();
  const { value } = mountView(beacon, () => useSupport(({ status }) => status));

  expect(value.current).toBe("unknown");
});

test("useTransitions reads the journal as it stands, which is off without one", () => {
  const { beacon } = createWebBeacon();
  const { value } = mountView(beacon, () => useTransitions());

  expect(value.current).toMatchObject({ journal: "off", latest: null });
});

test("useTransitions follows a checkpoint that is reported", () => {
  const { beacon } = createWebBeacon();

  const { value } = mountView(beacon, () =>
    useTransitions(({ checkpoints }) => checkpoints),
  );

  expect(value.current).toEqual([]);

  beacon.reportReady({ checkpoint: "primary-screen" });

  expect(value.current).toEqual(["primary-screen"]);
});

test("useBeacon follows the provider's Beacon through current", () => {
  const { beacon } = createWebBeacon();
  const { value } = mountView(beacon, () => useBeacon());

  expect(value.current).toBe(beacon);
});

test("a utility without a provider above it is misused", () => {
  const read = (use: () => unknown) => () =>
    render(View, { props: { read: use } });

  expect(read(() => useBeacon())).toThrow(BeaconError);
  expect(read(() => useBeacon())).toThrow(
    expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
  );
  expect(read(() => useRunning())).toThrow(
    "useBeacon needs a BeaconProvider above it.",
  );
  expect(read(() => useRoute("web"))).toThrow(BeaconError);
});

test("a provider that publishes another Beacon moves what useRoute, useRunning and useStatus read", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  first.beacon.start();
  await check(first, "web-build-a");

  const view = mountView(first.beacon, () => {
    const route = useRoute("web", ({ observation }) => observation.status);
    const running = useRunning(({ web }) => web.state);
    const status = useStatus(({ state }) => state);

    return {
      get current() {
        return `${route.current}/${running.current}/${status.current}`;
      },
    };
  });

  expect(view.value.current).toBe("available/known/running");

  await view.rerender({ beacon: second.beacon });
  flushSync();

  expect(view.value.current).toBe("unknown/pending/idle");

  // The first Beacon is let go: a subscription that was kept would read its stop.
  first.beacon.stop();

  expect(view.value.current).toBe("unknown/pending/idle");

  second.beacon.start();

  expect(view.value.current).toBe("unknown/pending/running");
});
