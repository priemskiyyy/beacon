import { BeaconError } from "@priemskiyyy/beacon";
import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, test } from "vitest";

import { BeaconProvider } from "src/context/BeaconProvider";
import { countListeners, createWebBeacon, target } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";
import { useBeacon } from "src/hooks/useBeacon";
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
