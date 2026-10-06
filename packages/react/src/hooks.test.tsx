import { BeaconError } from "@priemskiyyy/beacon";
import type { DisruptionParticipant, Impact } from "@priemskiyyy/beacon";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { Activity, StrictMode, useEffect, useLayoutEffect } from "react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, test } from "vitest";

import { BeaconProvider } from "src/context/BeaconProvider";
import { countListeners, createWebBeacon, target } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";
import { useBeacon } from "src/hooks/useBeacon";
import type { RegisteredRouteState } from "src/types/Register";
import { useDisruption } from "src/hooks/useDisruption";
import { useObservable } from "src/hooks/useObservable";
import { useRoute } from "src/hooks/useRoute";
import { useRunning } from "src/hooks/useRunning";
import { useStatus } from "src/hooks/useStatus";
import { useSupport } from "src/hooks/useSupport";
import { useTransitions } from "src/hooks/useTransitions";

afterEach(cleanup);

const flush = () => act(() => Promise.resolve());

const answer = (context: ReturnType<typeof createWebBeacon>, build: string) => {
  context.mock.resolve({
    document: { web: target(build) },
    expiresAt: 601_000,
  });
};

// The tree every hook below reads from, as an application publishes its Beacon once.
const providerOf =
  (beacon: WebBeacon) =>
  ({ children }: PropsWithChildren) => (
    <BeaconProvider beacon={beacon}>{children}</BeaconProvider>
  );

test("useRoute reads the route by name as it stands, and starts nothing", () => {
  const { beacon, mock } = createWebBeacon();

  const { result } = renderHook(() => useRoute("web"), {
    wrapper: providerOf(beacon),
  });

  expect(result.current).toMatchObject({
    check: { state: "idle" },
    observation: { status: "unknown", reason: "not-checked" },
  });
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
});

test("useRoute renders the offer once a check is accepted", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  const { result } = renderHook(() => useRoute("web"), {
    wrapper: providerOf(context.beacon),
  });

  context.beacon.start();

  const checking = web.check();

  await flush();
  answer(context, "web-build-a");
  await act(() => checking);

  expect(result.current.observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
  });
});

test("a route handle held outside a provider is read with useObservable", () => {
  const { beacon } = createWebBeacon();
  const { result } = renderHook(() => useObservable(beacon.route("web").state));

  expect(result.current.observation).toMatchObject({ status: "unknown" });
});

test("BIND-06 useRoute with a selector renders again only when the selection changes", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");
  const renders = { count: 0 };

  const { result } = renderHook(
    () => {
      renders.count += 1;

      return useRoute("web", ({ observation }) => observation.status);
    },
    { wrapper: providerOf(context.beacon) },
  );

  expect(result.current).toBe("unknown");

  context.beacon.start();

  const checking = web.check();

  await flush();
  answer(context, "web-build-a");
  await act(() => checking);

  const settled = renders.count;

  expect(result.current).toBe("available");

  const rechecking = web.check();

  await flush();
  answer(context, "web-build-a");
  await act(() => rechecking);

  expect(renders.count).toBe(settled);
});

test("an equal selection keeps its reference across renders, whatever new functions a render passes", () => {
  const { beacon } = createWebBeacon();

  const { result, rerender } = renderHook(
    () =>
      useRoute("web", ({ observation }) => ({ status: observation.status }), {
        isEqual: (previous, next) => previous.status === next.status,
      }),
    { wrapper: providerOf(beacon) },
  );

  const first = result.current;

  rerender();
  rerender();

  expect(result.current).toBe(first);
});

test("a selector that changes selects again from the same value", () => {
  const { beacon } = createWebBeacon();

  type Pick = (snapshot: RegisteredRouteState<"web">) => string;

  const byCheck: Pick = ({ check }) => check.state;
  const byObservation: Pick = ({ observation }) => observation.status;

  const { result, rerender } = renderHook(
    ({ pick }: { pick: Pick }) => useRoute("web", pick),
    { initialProps: { pick: byCheck }, wrapper: providerOf(beacon) },
  );

  expect(result.current).toBe("idle");

  rerender({ pick: byObservation });

  expect(result.current).toBe("unknown");
});

test("useObservable subscribes while mounted and lets go on unmount", () => {
  const { beacon } = createWebBeacon();
  const counted = countListeners(beacon.route("web").state);
  const { unmount } = renderHook(() => useObservable(counted.observable));

  expect(counted.listeners()).toBe(1);

  unmount();

  expect(counted.listeners()).toBe(0);
});

test("useObservable reads any observable of the Beacon, such as a route's native handle", () => {
  const { beacon } = createWebBeacon();

  beacon.start();

  const { result } = renderHook(() =>
    useObservable(beacon.route("web").native),
  );

  expect(result.current).toEqual({});
});

test("useRunning reads what is running, of the provider's Beacon", async () => {
  const { beacon } = createWebBeacon();

  const all = renderHook(() => useRunning(), { wrapper: providerOf(beacon) });

  const web = renderHook(() => useRunning(({ web }) => web.state), {
    wrapper: providerOf(beacon),
  });

  expect(all.result.current.web.state).toBe("pending");
  expect(web.result.current).toBe("pending");

  await act(async () => {
    beacon.start();
    await Promise.resolve();
  });

  expect(web.result.current).toBe("known");
});

test("useStatus reads where the session stands", () => {
  const { beacon } = createWebBeacon();

  const { result } = renderHook(() => useStatus(({ state }) => state), {
    wrapper: providerOf(beacon),
  });

  expect(result.current).toBe("idle");

  act(() => {
    beacon.start();
  });

  expect(result.current).toBe("running");
});

test("a hook without a provider above it is misused", () => {
  expect(() => renderHook(() => useBeacon())).toThrow(BeaconError);
  expect(() => renderHook(() => useRunning())).toThrow(
    "useBeacon needs a BeaconProvider above it.",
  );
  expect(() => renderHook(() => useRoute("web"))).toThrow(BeaconError);
});

test("the provider starts the session while mounted and ends it on unmount", () => {
  const { beacon } = createWebBeacon();

  const { unmount } = render(
    <BeaconProvider beacon={beacon} start>
      <span />
    </BeaconProvider>,
  );

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("the provider without start leaves the Beacon idle", () => {
  const { beacon } = createWebBeacon();

  render(
    <BeaconProvider beacon={beacon}>
      <span />
    </BeaconProvider>,
  );

  expect(beacon.status.get()).toEqual({ state: "idle" });
});

test("the provider follows start: it holds the session only while start is true", () => {
  const { beacon } = createWebBeacon();

  const view = (start: boolean) => (
    <BeaconProvider beacon={beacon} start={start}>
      <span />
    </BeaconProvider>
  );

  const { rerender } = render(view(false));

  expect(beacon.status.get()).toEqual({ state: "idle" });

  rerender(view(true));

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  rerender(view(false));

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  rerender(view(true));

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("the provider follows a new beacon: the old session ends and a new one starts", () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  const view = (beacon: WebBeacon) => (
    <BeaconProvider beacon={beacon} start>
      <span />
    </BeaconProvider>
  );

  const { rerender, unmount } = render(view(first.beacon));

  expect(first.beacon.status.get()).toEqual({ state: "running", session: 1 });

  rerender(view(second.beacon));

  expect(first.beacon.status.get()).toEqual({ state: "stopped" });
  expect(second.beacon.status.get()).toEqual({ state: "running", session: 1 });
  expect(second.mock.stats().reads).toBe(0);

  unmount();

  expect(second.beacon.status.get()).toEqual({ state: "stopped" });
});

test("a second provider with start shares the session, and the first of them to unmount ends it for both", () => {
  const { beacon } = createWebBeacon();

  const view = (inner: boolean) => (
    <BeaconProvider beacon={beacon} start>
      <BeaconProvider beacon={beacon} start={inner}>
        <span />
      </BeaconProvider>
    </BeaconProvider>
  );

  const { rerender } = render(view(true));

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  rerender(view(false));

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("the hooks read the provider's Beacon and follow a new one", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  await act(async () => {
    second.beacon.start();
    await Promise.resolve();
  });

  const Probe = () => {
    const state = useStatus(({ state }) => state);
    const route = useRoute("web", ({ check }) => check.state);
    const running = useRunning(({ web }) => web.state);

    return <span>{`${state}/${route}/${running}`}</span>;
  };

  const view = (beacon: WebBeacon) => (
    <BeaconProvider beacon={beacon}>
      <Probe />
    </BeaconProvider>
  );

  const { container, rerender } = render(view(first.beacon));

  expect(container.textContent).toBe("idle/idle/pending");

  rerender(view(second.beacon));

  expect(container.textContent).toBe("running/idle/known");

  // The first Beacon is let go: it says nothing anymore, and the second is heard.
  act(() => {
    second.beacon.stop();
    first.beacon.start();
  });

  expect(container.textContent).toBe("stopped/idle/known");
});

test("BIND-07 strict mode starts, stops and starts again, and leaves one session running with no check or command", () => {
  const { beacon, mock } = createWebBeacon();

  render(
    <StrictMode>
      <BeaconProvider beacon={beacon} start>
        <span />
      </BeaconProvider>
    </StrictMode>,
  );

  expect(beacon.status.get()).toMatchObject({ state: "running" });
  expect(mock.stats().reads).toBe(0);
});

test("strict mode leaves one subscription and one registration for a hook that reads and one that guards", async () => {
  const { beacon } = createWebBeacon();
  const counted = countListeners(beacon.status);
  const asked = { count: 0 };

  const View = () => {
    useObservable(counted.observable);

    useDisruption(
      draftEditor({
        reserve: () => {
          asked.count += 1;

          return { status: "reserved", release: () => {} };
        },
      }),
    );

    return null;
  };

  const { unmount } = render(
    <StrictMode>
      <BeaconProvider beacon={beacon} start>
        <View />
      </BeaconProvider>
    </StrictMode>,
  );

  expect(counted.listeners()).toBe(1);

  await act(async () => {
    await beacon.route("web").prefetch();
  });

  expect(asked.count).toBe(1);

  unmount();

  expect(counted.listeners()).toBe(0);
});

test("a child that checks when it mounts finds the session already started", async () => {
  const { beacon } = createWebBeacon();
  const outcomes: string[] = [];

  const Child = () => {
    useEffect(() => {
      beacon.check().then(({ routes }) => outcomes.push(routes.web.status));
    }, []);

    return null;
  };

  render(
    <StrictMode>
      <BeaconProvider beacon={beacon} start>
        <Child />
      </BeaconProvider>
    </StrictMode>,
  );

  await flush();

  expect(outcomes).not.toContain("failed");
});

test("the session starts after a child's layout effect and before its passive effect", () => {
  const { beacon } = createWebBeacon();
  const seen: string[] = [];

  const Child = () => {
    useLayoutEffect(() => {
      seen.push(`layout ${beacon.status.get().state}`);
    }, []);

    useEffect(() => {
      seen.push(`passive ${beacon.status.get().state}`);
    }, []);

    return null;
  };

  render(
    <BeaconProvider beacon={beacon} start>
      <Child />
    </BeaconProvider>,
  );

  expect(seen).toEqual(["layout idle", "passive running"]);
});

const draftEditor = (
  overrides: Partial<DisruptionParticipant> = {},
): DisruptionParticipant => ({
  name: "draft-editor",
  impacts: ["document-replacement"],
  reserve: () => ({ status: "reserved", release: () => {} }),
  ...overrides,
});

test("useDisruption registers while mounted and unregisters on unmount", async () => {
  const { beacon } = createWebBeacon();

  const { unmount } = renderHook(
    () =>
      useDisruption(
        draftEditor({
          reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
        }),
      ),
    { wrapper: providerOf(beacon) },
  );

  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "unsaved-draft", participant: { name: "draft-editor" } }],
  });

  unmount();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
});

test("useDisruption asks the latest participant, without registering again", async () => {
  const { beacon } = createWebBeacon();
  const asked = { count: 0 };

  const { rerender } = renderHook(
    ({ dirty }) =>
      useDisruption(
        draftEditor({
          reserve: () => {
            asked.count += 1;

            if (dirty) {
              return { status: "blocked", code: "unsaved-draft" };
            }

            return { status: "reserved", release: () => {} };
          },
        }),
      ),
    { initialProps: { dirty: true }, wrapper: providerOf(beacon) },
  );

  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });

  rerender({ dirty: false });
  rerender({ dirty: false });

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  // One registration is asked once per command: two would have been asked twice.
  expect(asked.count).toBe(2);
});

test("a participant in a subtree that Activity hides is unregistered while it is hidden, and registered again when it is shown", async () => {
  const { beacon } = createWebBeacon();

  const Editor = () => {
    useDisruption(
      draftEditor({
        reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
      }),
    );

    return null;
  };

  const view = (mode: "visible" | "hidden") => (
    <BeaconProvider beacon={beacon}>
      <Activity mode={mode}>
        <Editor />
      </Activity>
    </BeaconProvider>
  );

  const { rerender } = render(view("visible"));

  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });

  rerender(view("hidden"));

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });

  beacon.route("web").acknowledge();
  rerender(view("visible"));

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });
});

test("useDisruption asks the latest name and impacts too", async () => {
  const { beacon } = createWebBeacon();

  const { rerender } = renderHook(
    ({ name, impacts }: { name: string; impacts: Impact[] }) =>
      useDisruption(
        draftEditor({
          name,
          impacts,
          reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
        }),
      ),
    {
      initialProps: {
        name: "draft-editor",
        impacts: ["javascript-restart"],
      },
      wrapper: providerOf(beacon),
    },
  );

  beacon.start();

  // The command replaces the document, which this participant does not care about yet.
  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });

  beacon.route("web").acknowledge();
  rerender({ name: "renamed", impacts: ["document-replacement"] });

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
    reasons: [{ code: "unsaved-draft", participant: { name: "renamed" } }],
  });
});

test("useDisruption follows the provider's Beacon: it leaves the old one and joins the new one", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  const Editor = () => {
    useDisruption(
      draftEditor({
        reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
      }),
    );

    return null;
  };

  const view = (beacon: WebBeacon) => (
    <BeaconProvider beacon={beacon}>
      <Editor />
    </BeaconProvider>
  );

  const { rerender } = render(view(first.beacon));

  first.beacon.start();
  second.beacon.start();

  await expect(first.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });
  await expect(second.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });

  rerender(view(second.beacon));

  await expect(first.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  await expect(second.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });
});

test("useSupport reads support as it stands, which is unknown without a policy", () => {
  const { beacon } = createWebBeacon();

  const { result } = renderHook(() => useSupport(), {
    wrapper: providerOf(beacon),
  });

  expect(result.current).toMatchObject({
    status: "unknown",
    reason: "no-policy",
  });
});

test("useSupport with a selector renders the selection of the provider's Beacon", () => {
  const { beacon } = createWebBeacon();

  const { result } = renderHook(() => useSupport(({ status }) => status), {
    wrapper: providerOf(beacon),
  });

  expect(result.current).toBe("unknown");
});

test("useTransitions reads the journal as it stands, which is off without one", () => {
  const { beacon } = createWebBeacon();

  const { result } = renderHook(() => useTransitions(), {
    wrapper: providerOf(beacon),
  });

  expect(result.current).toMatchObject({ journal: "off", latest: null });
});

test("useTransitions renders again when a checkpoint is reported", () => {
  const { beacon } = createWebBeacon();

  const { result } = renderHook(
    () => useTransitions(({ checkpoints }) => checkpoints),
    { wrapper: providerOf(beacon) },
  );

  expect(result.current).toEqual([]);

  act(() => {
    beacon.reportReady({ checkpoint: "primary-screen" });
  });

  expect(result.current).toEqual(["primary-screen"]);
});

test("SAFE-14 a reservation a component held is released when the command ends, not when the component unmounts", async () => {
  const { beacon } = createWebBeacon();
  const released = { count: 0 };
  const settling: { finish: () => void } = { finish: () => {} };

  const { unmount } = renderHook(
    () =>
      useDisruption({
        name: "draft-editor",
        impacts: ["document-replacement"],
        reserve: () => ({
          status: "reserved",
          settle: () =>
            new Promise((resolve) => {
              settling.finish = () => resolve({ status: "ready" });
            }),
          release: () => {
            released.count += 1;
          },
        }),
      }),
    { wrapper: providerOf(beacon) },
  );

  beacon.start();

  const command = beacon.route("web").prefetch();

  await flush();
  unmount();

  expect(released.count).toBe(0);

  settling.finish();

  await expect(command).resolves.toMatchObject({ status: "blocked" });
  expect(released.count).toBe(1);
});
