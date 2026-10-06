import { BeaconError } from "@priemskiyyy/beacon";
import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { StrictMode, useEffect, useLayoutEffect, version } from "react";
import type { PropsWithChildren, ReactElement } from "react";
import { act, create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeAll, expect, test } from "vitest";

import { BeaconProvider } from "src/context/BeaconProvider";
import { countListeners, createWebBeacon, target } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";
import { useBeacon } from "src/hooks/useBeacon";
import { useDisruption } from "src/hooks/useDisruption";
import { useObservable } from "src/hooks/useObservable";
import { useRoute } from "src/hooks/useRoute";
import { useRunning } from "src/hooks/useRunning";
import { useBeaconStatus } from "src/hooks/useBeaconStatus";
import { useSupport } from "src/hooks/useSupport";
import { useTransitions } from "src/hooks/useTransitions";

// The binding rendered by a renderer that has no DOM, as a React Native app renders it: what comes out is a tree of host elements, and a host here is only a name. This file runs in the `react-native` project, in the environment test/hermes/setup.ts makes.

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

const mounted: ReactTestRenderer[] = [];

afterEach(async () => {
  for (const renderer of mounted.splice(0)) {
    await act(async () => {
      renderer.unmount();
    });
  }
});

// A concurrent root, the kind a React Native app renders into, since only those run Strict Mode's second pass of effects. The typings of the renderer do not name this option, and a variable is not checked for extra properties as a literal is.
const concurrent = {
  createNodeMock: () => null,
  unstable_isConcurrent: true,
};

const render = async (element: ReactElement) => {
  const made: { renderer: ReactTestRenderer | null } = { renderer: null };

  await act(async () => {
    made.renderer = create(element, concurrent);
  });

  const { renderer } = made;

  if (renderer === null) {
    throw new Error("Nothing was rendered.");
  }

  mounted.push(renderer);

  return renderer;
};

const update = async (renderer: ReactTestRenderer, element: ReactElement) => {
  await act(async () => {
    renderer.update(element);
  });
};

// The provider as an application writes it, which starts the session; `false` is `start={false}`, for a test that opens the session itself.
const providerOf =
  (beacon: WebBeacon, start = true) =>
  ({ children }: PropsWithChildren) => (
    <BeaconProvider beacon={beacon} start={start}>
      {children}
    </BeaconProvider>
  );

// What a hook returned on the last render, and how many renders there were.
const renderHook = async <TValue,>(
  hook: () => TValue,
  Wrapper: (props: PropsWithChildren) => ReactElement,
) => {
  const result: { current: TValue | null; renders: number } = {
    current: null,
    renders: 0,
  };

  const Probe = () => {
    result.current = hook();
    result.renders += 1;

    return null;
  };

  const renderer = await render(
    <Wrapper>
      <Probe />
    </Wrapper>,
  );

  return { result, renderer, Probe };
};

const answer = async (
  context: ReturnType<typeof createWebBeacon>,
  build: string,
) => {
  await act(async () => {
    context.mock.resolve({
      document: { web: target(build) },
      expiresAt: 601_000,
    });
  });
};

const draftEditor = (
  overrides: Partial<DisruptionParticipant> = {},
): DisruptionParticipant => ({
  name: "draft-editor",
  impacts: ["document-replacement"],
  reserve: () => ({ status: "reserved", release: () => {} }),
  ...overrides,
});

test("the tests run where there is no DOM: the window is the global object and nothing renders into a document", () => {
  expect(typeof document).toBe("undefined");
  expect(window).toBe(globalThis);
  expect(navigator).toEqual({ product: "ReactNative" });
});

test("the provider starts the session while mounted, ends it on unmount and leaves no listener behind", async () => {
  const { beacon } = createWebBeacon();
  const status = countListeners(beacon.status);

  beacon.status = status.observable;

  const renderer = await render(
    <BeaconProvider beacon={beacon}>
      <span />
    </BeaconProvider>,
  );

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  await act(async () => {
    renderer.unmount();
  });
  mounted.splice(0);

  expect(beacon.status.get()).toEqual({ state: "stopped" });
  expect(status.listeners()).toBe(0);
});

test("the host tree of the default provider shows a session that is running", async () => {
  const { beacon } = createWebBeacon();

  const Status = () => <span>{useBeaconStatus(({ state }) => state)}</span>;

  const renderer = await render(
    <BeaconProvider beacon={beacon}>
      <Status />
    </BeaconProvider>,
  );

  expect(renderer.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["running"],
  });
});

test("start false leaves the Beacon idle, and the host tree shows what the hooks read", async () => {
  const { beacon } = createWebBeacon();

  const Status = () => <span>{useBeaconStatus(({ state }) => state)}</span>;

  const renderer = await render(
    <BeaconProvider beacon={beacon} start={false}>
      <Status />
    </BeaconProvider>,
  );

  expect(renderer.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["idle"],
  });

  await act(async () => {
    beacon.start();
  });

  expect(renderer.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["running"],
  });
});

test("useRoute renders the offer once a check is accepted, and only what it selected", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  const { result } = await renderHook(
    () => useRoute("web"),
    providerOf(context.beacon),
  );

  expect(result.current).toMatchObject({
    check: { state: "idle" },
    observation: { status: "unknown", reason: "not-checked" },
  });
  expect(context.mock.stats().reads).toBe(0);

  const checking = web.check();

  await act(async () => {
    await Promise.resolve();
  });
  await answer(context, "web-build-a");
  await act(async () => {
    await checking;
  });

  expect(result.current?.observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
  });
});

test("BIND-06 a selection that has not changed renders nothing again, whatever new selector a render passes", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  const { result } = await renderHook(
    () => useRoute("web", ({ observation }) => observation.status),
    providerOf(context.beacon),
  );

  const checking = web.check();

  await act(async () => {
    await Promise.resolve();
  });
  await answer(context, "web-build-a");
  await act(async () => {
    await checking;
  });

  const settled = result.renders;

  expect(result.current).toBe("available");

  const rechecking = web.check();

  await act(async () => {
    await Promise.resolve();
  });
  await answer(context, "web-build-a");
  await act(async () => {
    await rechecking;
  });

  expect(result.renders).toBe(settled);
});

test("a selector that builds a new object on every call is read once per change, not in a loop", async () => {
  const context = createWebBeacon();

  const { result } = await renderHook(
    () =>
      useRoute("web", ({ check }) => ({ state: check.state }), {
        isEqual: (previous, next) => previous.state === next.state,
      }),
    providerOf(context.beacon, false),
  );

  const first = result.current;

  await act(async () => {
    context.beacon.start();
  });

  expect(result.current).toBe(first);
  expect(result.renders).toBeLessThan(5);
});

test("useObservable subscribes while mounted and lets go on unmount", async () => {
  const { beacon } = createWebBeacon();
  const counted = countListeners(beacon.route("web").state);

  const { renderer } = await renderHook(
    () => useObservable(counted.observable),
    providerOf(beacon),
  );

  expect(counted.listeners()).toBe(1);

  await act(async () => {
    renderer.unmount();
  });
  mounted.splice(0);

  expect(counted.listeners()).toBe(0);
});

test("useRunning, useBeaconStatus, useSupport and useTransitions read the provider's Beacon and let go on unmount", async () => {
  const { beacon } = createWebBeacon();
  const running = countListeners(beacon.running);
  const status = countListeners(beacon.status);
  const support = countListeners(beacon.support);
  const transitions = countListeners(beacon.transitions);

  beacon.running = running.observable;
  beacon.status = status.observable;
  beacon.support = support.observable;
  beacon.transitions = transitions.observable;

  const { result, renderer } = await renderHook(
    () => ({
      web: useRunning(({ web }) => web.state),
      state: useBeaconStatus(({ state }) => state),
      support: useSupport(({ status }) => status),
      journal: useTransitions(({ journal }) => journal),
      checkpoints: useTransitions(({ checkpoints }) => checkpoints),
    }),
    providerOf(beacon, false),
  );

  expect(result.current).toEqual({
    web: "pending",
    state: "idle",
    support: "unknown",
    journal: "off",
    checkpoints: [],
  });

  await act(async () => {
    beacon.start();
    await Promise.resolve();
  });

  expect(result.current).toMatchObject({ web: "known", state: "running" });

  await act(async () => {
    beacon.reportReady({ checkpoint: "primary-screen" });
  });

  expect(result.current?.checkpoints).toEqual(["primary-screen"]);
  expect(running.listeners()).toBe(1);
  expect(status.listeners()).toBe(1);
  expect(support.listeners()).toBe(1);
  expect(transitions.listeners()).toBe(2);

  await act(async () => {
    renderer.unmount();
  });
  mounted.splice(0);

  expect(running.listeners()).toBe(0);
  expect(status.listeners()).toBe(0);
  expect(support.listeners()).toBe(0);
  expect(transitions.listeners()).toBe(0);
});

test("a hook without a provider above it is misused, as it is on the web", async () => {
  const Missing = () => {
    useBeacon();

    return null;
  };

  let failure: unknown = null;

  try {
    await render(<Missing />);
  } catch (error) {
    failure = error;
  }

  expect(failure).toBeInstanceOf(BeaconError);
  expect(failure).toMatchObject({
    message:
      "useBeacon needs a BeaconProvider (from @priemskiyyy/beacon-react) above it.",
  });
});

test("useDisruption registers while mounted, asks the latest participant, and unregisters on unmount", async () => {
  const { beacon } = createWebBeacon();
  const asked = { count: 0 };

  const Editor = ({ dirty }: { dirty: boolean }) => {
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
    );

    return null;
  };

  const view = (dirty: boolean) => (
    <BeaconProvider beacon={beacon} start={false}>
      <Editor dirty={dirty} />
    </BeaconProvider>
  );

  const renderer = await render(view(true));

  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "unsaved-draft", participant: { name: "draft-editor" } }],
  });

  await update(renderer, view(false));

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  // One registration is asked once per command: two would have been asked twice.
  expect(asked.count).toBe(2);

  beacon.route("web").acknowledge();

  await act(async () => {
    renderer.unmount();
  });
  mounted.splice(0);

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  expect(asked.count).toBe(2);
});

test("a command started by a press reaches the provider's Beacon, and a participant that guards unsaved work blocks it", async () => {
  const { beacon } = createWebBeacon();
  const outcomes: string[] = [];

  const Update = ({ guarded }: { guarded: boolean }) => {
    const current = useBeacon();

    useDisruption(
      draftEditor({
        reserve: () => {
          if (guarded) {
            return { status: "blocked", code: "unsaved-draft" };
          }

          return { status: "reserved", release: () => {} };
        },
      }),
    );

    return (
      <button
        onClick={async () => {
          const outcome = await current.route("web").prefetch();

          outcomes.push(outcome.status);
        }}
      />
    );
  };

  const view = (guarded: boolean) => (
    <BeaconProvider beacon={beacon}>
      <Update guarded={guarded} />
    </BeaconProvider>
  );

  const renderer = await render(view(true));
  const press = () => renderer.root.findByType("button").props.onClick();

  await act(async () => {
    await press();
  });

  await update(renderer, view(false));
  await act(async () => {
    await press();
  });

  expect(outcomes).toEqual(["blocked", "accepted"]);
});

test("BIND-07 strict mode on a concurrent root starts, stops and starts again, and leaves one session, one subscription and one registration", async () => {
  const { beacon, mock } = createWebBeacon();
  const status = countListeners(beacon.status);
  const asked = { count: 0 };

  beacon.status = status.observable;

  const effects = { passes: 0 };

  const View = () => {
    useBeaconStatus();

    useEffect(() => {
      effects.passes += 1;
    }, []);

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

  const renderer = await render(
    <StrictMode>
      <BeaconProvider beacon={beacon}>
        <View />
      </BeaconProvider>
    </StrictMode>,
  );

  // The test renderer of React 19 runs Strict Mode's second pass of effects and the one of React 18 does not, so a session is started once per pass: ended and started again after the second.
  expect(effects.passes).toBe(Number(version.split(".")[0]) >= 19 ? 2 : 1);
  expect(beacon.status.get()).toEqual({
    state: "running",
    session: effects.passes,
  });
  expect(status.listeners()).toBe(1);
  expect(mock.stats().reads).toBe(0);

  await act(async () => {
    await beacon.route("web").prefetch();
  });

  expect(asked.count).toBe(1);

  await act(async () => {
    renderer.unmount();
  });
  mounted.splice(0);

  expect(status.listeners()).toBe(0);
  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("a child that checks when it mounts finds the session started, under strict mode too", async () => {
  const { beacon } = createWebBeacon();
  const outcomes: string[] = [];

  const Child = () => {
    useEffect(() => {
      beacon.check().then(({ routes }) => outcomes.push(routes.web.status));
    }, []);

    return null;
  };

  await render(
    <StrictMode>
      <BeaconProvider beacon={beacon}>
        <Child />
      </BeaconProvider>
    </StrictMode>,
  );

  await act(async () => {
    await Promise.resolve();
  });

  expect(outcomes).not.toContain("failed");
});

test("the session starts after a child's layout effect and before its passive effect", async () => {
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

  await render(
    <BeaconProvider beacon={beacon}>
      <Child />
    </BeaconProvider>,
  );

  expect(seen).toEqual(["layout idle", "passive running"]);
});

test("a remount of the provider, as Fast Refresh makes it, starts a new session on the same Beacon and loses nothing", async () => {
  const { beacon } = createWebBeacon();

  const first = await render(
    <BeaconProvider beacon={beacon}>
      <span />
    </BeaconProvider>,
  );

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  await act(async () => {
    first.unmount();
  });
  mounted.splice(0);

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  await render(
    <BeaconProvider beacon={beacon}>
      <span />
    </BeaconProvider>,
  );

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("a Beacon made again by a module that Fast Refresh ran again takes over: the old session ends and the new one starts", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  const view = (beacon: WebBeacon) => (
    <BeaconProvider beacon={beacon}>
      <span />
    </BeaconProvider>
  );

  const renderer = await render(view(first.beacon));

  expect(first.beacon.status.get()).toEqual({ state: "running", session: 1 });

  await update(renderer, view(second.beacon));

  expect(first.beacon.status.get()).toEqual({ state: "stopped" });
  expect(second.beacon.status.get()).toEqual({ state: "running", session: 1 });
  expect(second.mock.stats().reads).toBe(0);
});

test("the provider follows start: it holds the session only while start is true", async () => {
  const { beacon } = createWebBeacon();

  const view = (start: boolean) => (
    <BeaconProvider beacon={beacon} start={start}>
      <span />
    </BeaconProvider>
  );

  const renderer = await render(view(false));

  expect(beacon.status.get()).toEqual({ state: "idle" });

  await update(renderer, view(true));

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  await update(renderer, view(false));

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  // A start that is left out is the default, which starts.
  await update(
    renderer,
    <BeaconProvider beacon={beacon}>
      <span />
    </BeaconProvider>,
  );

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("start false on a host without a DOM leaves the session to the application, and its unmount ends nothing", async () => {
  const { beacon } = createWebBeacon();

  const renderer = await render(
    <BeaconProvider beacon={beacon} start={false}>
      <span />
    </BeaconProvider>,
  );

  const stop = beacon.start();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  await act(async () => {
    renderer.unmount();
  });
  mounted.splice(0);

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  stop();
});
