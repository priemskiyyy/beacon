import { BeaconError } from "@priemskiyyy/beacon";
import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, test } from "vitest";

import { BeaconProvider } from "src/context/BeaconProvider";
import { countListeners, createWebBeacon, target } from "src/beacon.fixture";
import { useBeacon } from "src/hooks/useBeacon";
import { useDisruption } from "src/hooks/useDisruption";
import { useRoute } from "src/hooks/useRoute";
import { useRunning } from "src/hooks/useRunning";
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

test("useRoute reads the route as it stands, and starts nothing", () => {
  const { beacon, mock } = createWebBeacon();
  const { result } = renderHook(() => useRoute(beacon.route("web")));

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
  const { result } = renderHook(() => useRoute(web));

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

test("useRoute with a selector renders again only when the selection changes", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");
  const renders = { count: 0 };

  const { result } = renderHook(() => {
    renders.count += 1;

    return useRoute(web, ({ observation }) => observation.status);
  });

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

test("useRoute subscribes while mounted and lets go on unmount", () => {
  const { beacon } = createWebBeacon();
  const web = beacon.route("web");
  const counted = countListeners(web.state);
  const { unmount } = renderHook(() => useRoute({ state: counted.observable }));

  expect(counted.listeners()).toBe(1);

  unmount();

  expect(counted.listeners()).toBe(0);
});

test("useRunning reads what is running, of the given Beacon or the provider's", async () => {
  const { beacon } = createWebBeacon();

  const wrapper = ({ children }: PropsWithChildren) => (
    <BeaconProvider beacon={beacon}>{children}</BeaconProvider>
  );

  const given = renderHook(() => useRunning(beacon, ({ web }) => web.state));
  const provided = renderHook(() => useRunning(), { wrapper });

  expect(given.result.current).toBe("pending");
  expect(provided.result.current.web.state).toBe("pending");

  await act(async () => {
    beacon.start();
    await Promise.resolve();
  });

  expect(given.result.current).toBe("known");
});

test("a hook with neither a Beacon nor a provider is misused", () => {
  expect(() => renderHook(() => useBeacon())).toThrow(BeaconError);
  expect(() => renderHook(() => useRunning())).toThrow(
    "useRunning needs a Beacon, passed in or from a BeaconProvider.",
  );
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

test("strict mode starts, stops and starts again, and leaves one session running", () => {
  const { beacon } = createWebBeacon();

  render(
    <StrictMode>
      <BeaconProvider beacon={beacon} start>
        <span />
      </BeaconProvider>
    </StrictMode>,
  );

  expect(beacon.status.get()).toMatchObject({ state: "running" });
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
  const context = createWebBeacon();
  const { beacon } = context;

  const { unmount } = renderHook(() =>
    useDisruption(
      draftEditor({
        reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
      }),
      beacon,
    ),
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
  const registered = { count: 0 };
  const register = beacon.disruptions.register;

  const disruptions = {
    register: (participant: DisruptionParticipant) => {
      registered.count += 1;

      return register(participant);
    },
  };

  const { rerender } = renderHook(
    ({ dirty }) =>
      useDisruption(
        draftEditor({
          reserve: () => {
            if (dirty) {
              return { status: "blocked", code: "unsaved-draft" };
            }

            return { status: "reserved", release: () => {} };
          },
        }),
        { ...beacon, disruptions },
      ),
    { initialProps: { dirty: true } },
  );

  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });

  rerender({ dirty: false });

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  expect(registered.count).toBe(1);
});

test("useSupport reads support as it stands, which is unknown without a policy", () => {
  const { beacon } = createWebBeacon();
  const { result } = renderHook(() => useSupport(beacon));

  expect(result.current).toMatchObject({
    status: "unknown",
    reason: "no-policy",
  });
});

test("useSupport with a selector renders the selection of the provider's Beacon", () => {
  const { beacon } = createWebBeacon();

  const wrapper = ({ children }: PropsWithChildren) => (
    <BeaconProvider beacon={beacon}>{children}</BeaconProvider>
  );

  const { result } = renderHook(
    () => useSupport(beacon, ({ status }) => status),
    { wrapper },
  );

  expect(result.current).toBe("unknown");
});

test("useTransitions reads the journal as it stands, which is off without one", () => {
  const { beacon } = createWebBeacon();
  const { result } = renderHook(() => useTransitions(beacon));

  expect(result.current).toMatchObject({ journal: "off", latest: null });
});

test("useTransitions renders again when a checkpoint is reported", () => {
  const { beacon } = createWebBeacon();

  const { result } = renderHook(() =>
    useTransitions(beacon, ({ checkpoints }) => checkpoints),
  );

  expect(result.current).toEqual([]);

  act(() => {
    beacon.reportReady({ checkpoint: "primary-screen" });
  });

  expect(result.current).toEqual(["primary-screen"]);
});
