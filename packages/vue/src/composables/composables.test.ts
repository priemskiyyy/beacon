import { BeaconError } from "@priemskiyyy/beacon";
import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { settle } from "@priemskiyyy/beacon/mock";
import { expect, test, vi } from "vitest";
import { nextTick, onMounted, ref, shallowRef, watch, watchEffect } from "vue";
import type { Ref } from "vue";

import { countListeners, createWebBeacon, target } from "src/beacon.fixture";
import { useBeacon } from "src/composables/useBeacon";
import { useDisruption } from "src/composables/useDisruption";
import { useObservable } from "src/composables/useObservable";
import { useRoute } from "src/composables/useRoute";
import { useRunning } from "src/composables/useRunning";
import { useBeaconStatus } from "src/composables/useBeaconStatus";
import { useSupport } from "src/composables/useSupport";
import { useTransitions } from "src/composables/useTransitions";
import { mount } from "src/mount.fixture";

const answer = (context: ReturnType<typeof createWebBeacon>, build: string) => {
  context.mock.resolve({
    document: { web: target(build) },
    expiresAt: 601_000,
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

// Counts how often a ref changed, which is how often anything that reads it would run again.
const countChanges = (value: Ref<unknown>) => {
  const changes = { count: 0 };

  watch(
    value,
    () => {
      changes.count += 1;
    },
    { flush: "sync" },
  );

  return changes;
};

test("useRoute reads the route by name as it stands, and starts nothing", () => {
  const { beacon, mock } = createWebBeacon();

  const { value, warnings } = mount(() => useRoute("web"), {
    beacon,
    start: false,
  });

  expect(value.value).toMatchObject({
    check: { state: "idle" },
    observation: { status: "unknown", reason: "not-checked" },
  });
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
  expect(warnings).toEqual([]);
});

test("useRoute reads the offer once a check is accepted", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  const { value } = mount(() => useRoute("web"), { beacon: context.beacon });

  const checking = web.check();

  await settle();
  answer(context, "web-build-a");
  await checking;

  expect(value.value.observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
  });
});

test("a composable reads the value as it was before any session in setup, and the live one once mounted", async () => {
  const { beacon } = createWebBeacon();

  beacon.start();
  await settle();

  expect(beacon.running.get().web.state).toBe("known");

  const setup: string[] = [];

  const { value } = mount(
    () => {
      const web = useRunning(({ web }) => web.state);

      setup.push(web.value);

      return web;
    },
    { beacon },
  );

  expect(setup).toEqual(["pending"]);
  expect(value.value).toBe("known");
});

test("a route handle held outside a provider is read with useObservable", () => {
  const { beacon } = createWebBeacon();

  const { value } = mount(() => useObservable(beacon.route("web").state));

  expect(value.value.observation).toMatchObject({ status: "unknown" });
});

test("useObservable reads any observable of the Beacon, such as a route's native handle", () => {
  const { beacon } = createWebBeacon();

  beacon.start();

  const { value } = mount(() => useObservable(beacon.route("web").native));

  expect(value.value).toEqual({});
});

test("useObservable subscribes once mounted and lets go on unmount", () => {
  const { beacon } = createWebBeacon();
  const counted = countListeners(beacon.route("web").state);
  const setup: number[] = [];

  const { unmount } = mount(() => {
    const state = useObservable(counted.observable);

    setup.push(counted.listeners());

    return state;
  });

  expect(setup).toEqual([0]);
  expect(counted.listeners()).toBe(1);

  unmount();

  expect(counted.listeners()).toBe(0);
});

test("a value that is unmounted no longer follows the observable", () => {
  const { beacon } = createWebBeacon();

  const { value, unmount } = mount(() => useObservable(beacon.status), {
    beacon,
    start: false,
  });

  unmount();
  beacon.start();

  expect(value.value).toEqual({ state: "idle" });
});

test("useRunning reads what is running, of the provider's Beacon", async () => {
  const { beacon } = createWebBeacon();
  const all = mount(() => useRunning(), { beacon, start: false });

  const web = mount(() => useRunning(({ web }) => web.state), {
    beacon,
    start: false,
  });

  expect(all.value.value.web.state).toBe("pending");
  expect(web.value.value).toBe("pending");

  beacon.start();
  await settle();

  expect(all.value.value.web.state).toBe("known");
  expect(web.value.value).toBe("known");
});

test("useBeaconStatus reads where the session stands: running under a provider that starts it, and idle until a session opens under one that does not", () => {
  const started = createWebBeacon();
  const idle = createWebBeacon();

  const running = mount(() => useBeaconStatus(({ state }) => state), {
    beacon: started.beacon,
  });

  const waiting = mount(() => useBeaconStatus(({ state }) => state), {
    beacon: idle.beacon,
    start: false,
  });

  expect(running.value.value).toBe("running");
  expect(waiting.value.value).toBe("idle");

  idle.beacon.start();

  expect(waiting.value.value).toBe("running");
});

test("useSupport reads support as it stands, which is unknown without a policy", () => {
  const { beacon } = createWebBeacon();
  const { value } = mount(() => useSupport(), { beacon });

  expect(value.value).toMatchObject({ status: "unknown", reason: "no-policy" });
});

test("useSupport with a selector reads the selection of the provider's Beacon", () => {
  const { beacon } = createWebBeacon();

  const { value } = mount(() => useSupport(({ status }) => status), {
    beacon,
  });

  expect(value.value).toBe("unknown");
});

test("useTransitions reads the journal as it stands, which is off without one", () => {
  const { beacon } = createWebBeacon();
  const { value } = mount(() => useTransitions(), { beacon });

  expect(value.value).toMatchObject({ journal: "off", latest: null });
});

test("useTransitions changes when a checkpoint is reported", () => {
  const { beacon } = createWebBeacon();

  const { value } = mount(
    () => useTransitions(({ checkpoints }) => checkpoints),
    { beacon },
  );

  expect(value.value).toEqual([]);

  beacon.reportReady({ checkpoint: "primary-screen" });

  expect(value.value).toEqual(["primary-screen"]);
});

test("the composables return refs that refuse to be written", () => {
  const { beacon } = createWebBeacon();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  const { value } = mount(
    () => ({ route: useRoute("web"), beacon: useBeacon() }),
    { beacon },
  );

  Reflect.set(value.route, "value", "replaced");
  Reflect.set(value.beacon, "value", "replaced");

  expect(value.route.value).toMatchObject({ check: { state: "idle" } });
  expect(value.beacon.value).toBe(beacon);
  expect(warn).toHaveBeenCalledTimes(2);
});

test("BIND-06 useRoute with a selector changes only when the selection changes", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  const { value } = mount(
    () => {
      const status = useRoute("web", ({ observation }) => observation.status);

      return { status, changes: countChanges(status) };
    },
    { beacon: context.beacon },
  );

  expect(value.status.value).toBe("unknown");

  const checking = web.check();

  await settle();
  answer(context, "web-build-a");
  await checking;

  const settled = value.changes.count;

  expect(value.status.value).toBe("available");
  expect(settled).toBe(1);

  const rechecking = web.check();

  await settle();
  answer(context, "web-build-a");
  await rechecking;

  expect(value.changes.count).toBe(settled);
});

test("a selection that isEqual calls the same keeps the last one, and without isEqual a new object replaces it", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  const { value } = mount(
    () => {
      const equal = useRoute(
        "web",
        ({ observation }) => ({ status: observation.status }),
        { isEqual: (previous, next) => previous.status === next.status },
      );

      const identical = useRoute("web", ({ observation }) => ({
        status: observation.status,
      }));

      return {
        equal,
        identical,
        equalChanges: countChanges(equal),
        identicalChanges: countChanges(identical),
      };
    },
    { beacon: context.beacon },
  );

  const first = value.equal.value;

  const checking = web.check();

  await settle();

  // The check is running: the route's state changed, and its observation did not.
  expect(value.equal.value).toBe(first);
  expect(value.equalChanges.count).toBe(0);
  expect(value.identical.value).not.toBe(first);
  expect(value.identicalChanges.count).toBeGreaterThan(0);

  answer(context, "web-build-a");
  await checking;

  expect(value.equal.value).toEqual({ status: "available" });
  expect(value.equalChanges.count).toBe(1);
});

test("an effect that starts the session does not come to depend on the status it changes", async () => {
  const { beacon } = createWebBeacon();
  const effect = { runs: 0 };

  const { value } = mount(
    () => {
      const status = useBeaconStatus(({ state }) => state);

      // Runs after the value subscribed, so starting notifies it while this effect is running.
      onMounted(() => {
        watchEffect(() => {
          effect.runs += 1;
          beacon.start();
        });
      });

      return status;
    },
    { beacon, start: false },
  );

  expect(value.value).toBe("running");

  beacon.stop();
  await nextTick();

  expect(value.value).toBe("stopped");
  expect(effect.runs).toBe(1);
});

test("a composable without a provider above it is misused, and the error names the composable that was called and the package that has the provider", () => {
  const needs = (composable: string) =>
    `${composable} needs a BeaconProvider (from @priemskiyyy/beacon-vue) above it.`;

  expect(() => mount(() => useBeacon())).toThrow(BeaconError);
  expect(() => mount(() => useBeacon())).toThrow(needs("useBeacon"));
  expect(() => mount(() => useRunning())).toThrow(needs("useRunning"));
  expect(() => mount(() => useRoute("web"))).toThrow(needs("useRoute"));
  expect(() => mount(() => useBeaconStatus())).toThrow(
    needs("useBeaconStatus"),
  );
  expect(() => mount(() => useSupport())).toThrow(needs("useSupport"));
  expect(() => mount(() => useTransitions())).toThrow(needs("useTransitions"));
  expect(() => mount(() => useDisruption(draftEditor()))).toThrow(
    needs("useDisruption"),
  );
});

test("useBeacon returns the provider's Beacon and follows a new one", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const beacon = shallowRef(first.beacon);
  const { value } = mount(() => useBeacon(), { beacon });

  expect(value.value).toBe(first.beacon);

  beacon.value = second.beacon;
  await nextTick();

  expect(value.value).toBe(second.beacon);
});

test("the composables follow a provider that publishes another Beacon", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  first.beacon.start();

  const beacon = shallowRef(first.beacon);

  const { value } = mount(
    () => ({
      status: useBeaconStatus(({ state }) => state),
      route: useRoute("web", ({ observation }) => observation.status),
    }),
    { beacon, start: false },
  );

  expect(value.status.value).toBe("running");

  beacon.value = second.beacon;
  await nextTick();

  expect(value.status.value).toBe("idle");

  // The old Beacon is let go of: it says nothing anymore, and the new one is heard.
  first.beacon.stop();

  expect(value.status.value).toBe("idle");

  second.beacon.start();

  expect(value.status.value).toBe("running");

  const checking = second.beacon.route("web").check();

  await settle();
  answer(second, "web-build-a");
  await checking;

  expect(value.route.value).toBe("available");
});

test("an effect that reads the provider's Beacon and a selection sees the new Beacon with its selection, never a mix", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  second.beacon.start();

  const beacon = shallowRef(first.beacon);
  const seen: string[] = [];

  mount(
    () => {
      const provided = useBeacon();
      const state = useBeaconStatus(({ state }) => state);

      watchEffect(() => {
        seen.push(`${provided.value.status.get().state}/${state.value}`);
      });
    },
    { beacon, start: false },
  );

  expect(seen).toEqual(["idle/idle"]);

  beacon.value = second.beacon;
  await nextTick();

  expect(seen).toEqual(["idle/idle", "running/running"]);
});

test("the provider starts the session while mounted and ends it on unmount, with no prop asked for", () => {
  const { beacon, mock } = createWebBeacon();
  const { unmount, warnings } = mount(() => null, { beacon });

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });
  // Starting a session checks nothing.
  expect(mock.stats().reads).toBe(0);

  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
  expect(warnings).toEqual([]);
});

test("start true says what the default says", () => {
  const { beacon } = createWebBeacon();
  const { unmount } = mount(() => null, { beacon, start: true });

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("a child that checks when it mounts finds the session already started", async () => {
  const { beacon } = createWebBeacon();
  const outcomes: string[] = [];

  mount(
    () => {
      onMounted(() => {
        beacon.check().then(({ routes }) => outcomes.push(routes.web.status));
      });

      return null;
    },
    { beacon },
  );

  await settle();

  expect(outcomes).not.toContain("failed");
});

test("start false leaves the Beacon idle, for an application that starts the session itself, and its unmount ends nothing", () => {
  const { beacon } = createWebBeacon();
  const { unmount } = mount(() => null, { beacon, start: false });

  expect(beacon.status.get()).toEqual({ state: "idle" });

  const stop = beacon.start();

  unmount();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  stop();
});

test("the provider follows its start prop", async () => {
  const { beacon } = createWebBeacon();
  const start = ref(false);

  mount(() => null, { beacon, start });

  expect(beacon.status.get()).toEqual({ state: "idle" });

  start.value = true;
  await nextTick();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  start.value = false;
  await nextTick();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  // A start that is undefined is the default, which starts.
  Reflect.set(start, "value", undefined);
  await nextTick();

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("the provider follows its beacon prop: the old session ends and the new one starts", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const beacon = shallowRef(first.beacon);

  const { unmount } = mount(() => null, { beacon });

  expect(first.beacon.status.get()).toMatchObject({ state: "running" });
  expect(second.beacon.status.get()).toEqual({ state: "idle" });

  beacon.value = second.beacon;
  await nextTick();

  expect(first.beacon.status.get()).toEqual({ state: "stopped" });
  expect(second.beacon.status.get()).toMatchObject({ state: "running" });

  unmount();

  expect(second.beacon.status.get()).toEqual({ state: "stopped" });
});

test("the provider's stop ends the session a scope replacement restarted", () => {
  const { beacon } = createWebBeacon();
  const { unmount } = mount(() => null, { beacon });

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

test("an effect that sees the provider's new Beacon finds its session started", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const beacon = shallowRef(first.beacon);
  const seen: string[] = [];

  mount(
    () => {
      const provided = useBeacon();

      watchEffect(
        () => {
          seen.push(provided.value.status.get().state);
        },
        { flush: "sync" },
      );
    },
    { beacon },
  );

  beacon.value = second.beacon;
  await nextTick();

  expect(seen).toEqual(["running", "running"]);
});

test("the provider ends only its own session and never disposes the Beacon", () => {
  const { beacon } = createWebBeacon();
  const { unmount } = mount(() => null, { beacon });

  unmount();

  expect(beacon.status.get().state).not.toBe("disposed");
  expect(beacon.start()).toBeTypeOf("function");
  expect(beacon.status.get()).toMatchObject({ state: "running" });
});

test("BIND-07 a provider that is mounted again starts a new session, and one session is left running with no check or command", () => {
  const { beacon, mock } = createWebBeacon();

  const first = mount(() => null, { beacon });

  first.unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  const second = mount(() => null, { beacon });

  expect(beacon.status.get()).toMatchObject({ state: "running" });
  expect(mock.stats().reads).toBe(0);
  expect(second.warnings).toEqual([]);
});

test("useDisruption registers while mounted and unregisters on unmount", async () => {
  const { beacon } = createWebBeacon();

  const { unmount } = mount(
    () =>
      useDisruption(
        draftEditor({
          reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
        }),
      ),
    { beacon, start: false },
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

test("useDisruption registers once, and its closures read reactive state when Beacon asks", async () => {
  const { beacon } = createWebBeacon();
  const dirty = ref(true);
  const asked = { count: 0 };

  mount(
    () =>
      useDisruption(
        draftEditor({
          reserve: () => {
            asked.count += 1;

            if (dirty.value) {
              return { status: "blocked", code: "unsaved-draft" };
            }

            return { status: "reserved", release: () => {} };
          },
        }),
      ),
    { beacon, start: false },
  );

  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });

  dirty.value = false;
  await nextTick();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  // One registration is asked once per command: two would have been asked twice.
  expect(asked.count).toBe(2);
});

test("useDisruption moves to the Beacon a provider publishes next", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const beacon = shallowRef(first.beacon);

  first.beacon.start();
  second.beacon.start();

  mount(
    () =>
      useDisruption(
        draftEditor({
          reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
        }),
      ),
    { beacon, start: false },
  );

  await expect(first.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });
  await expect(second.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });

  beacon.value = second.beacon;
  await nextTick();

  await expect(first.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  await expect(second.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });
});

test("a command dispatched the moment the provider's new Beacon is seen finds the participant", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  first.beacon.start();
  second.beacon.start();

  const beacon = shallowRef(first.beacon);
  const asked = { count: 0 };
  const outcomes: Array<Promise<unknown>> = [];

  mount(
    () => {
      const provided = useBeacon();

      // Created before the composable, so it runs first unless the registration moves at once.
      watchEffect(() => {
        const current = provided.value;

        if (current !== second.beacon) {
          return;
        }

        outcomes.push(current.route("web").prefetch());
      });

      useDisruption(
        draftEditor({
          reserve: () => {
            asked.count += 1;

            return { status: "reserved", release: () => {} };
          },
        }),
      );
    },
    { beacon, start: false },
  );

  beacon.value = second.beacon;
  await nextTick();
  await Promise.all(outcomes);

  expect(outcomes).toHaveLength(1);
  expect(asked.count).toBe(1);
});

test("SAFE-14 a reservation a component held is released when the command ends, not when the component unmounts", async () => {
  const { beacon } = createWebBeacon();
  const released = { count: 0 };
  const settling: { finish: () => void } = { finish: () => {} };

  const { unmount } = mount(
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
    { beacon, start: false },
  );

  beacon.start();

  const command = beacon.route("web").prefetch();

  await settle();
  unmount();

  expect(released.count).toBe(0);

  settling.finish();

  await expect(command).resolves.toMatchObject({ status: "blocked" });
  expect(released.count).toBe(1);
});
