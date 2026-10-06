import { BeaconError } from "@priemskiyyy/beacon";
import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { expect, test, vi } from "vitest";
import { nextTick, onMounted, ref, shallowRef, watch, watchEffect } from "vue";
import type { Ref } from "vue";

import {
  countListeners,
  createWebBeacon,
  settle,
  target,
} from "src/beacon.fixture";
import { useBeacon } from "src/composables/useBeacon";
import { useDisruption } from "src/composables/useDisruption";
import { useObservable } from "src/composables/useObservable";
import { useRoute } from "src/composables/useRoute";
import { useRunning } from "src/composables/useRunning";
import { useStatus } from "src/composables/useStatus";
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
  const { value, warnings } = mount(() => useRoute("web"), { beacon });

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

  context.beacon.start();

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
  });

  unmount();
  beacon.start();

  expect(value.value).toEqual({ state: "idle" });
});

test("useRunning reads what is running, of the provider's Beacon", async () => {
  const { beacon } = createWebBeacon();
  const all = mount(() => useRunning(), { beacon });
  const web = mount(() => useRunning(({ web }) => web.state), { beacon });

  expect(all.value.value.web.state).toBe("pending");
  expect(web.value.value).toBe("pending");

  beacon.start();
  await settle();

  expect(all.value.value.web.state).toBe("known");
  expect(web.value.value).toBe("known");
});

test("useStatus reads where the session stands", () => {
  const { beacon } = createWebBeacon();

  const { value } = mount(() => useStatus(({ state }) => state), { beacon });

  expect(value.value).toBe("idle");

  beacon.start();

  expect(value.value).toBe("running");
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

  context.beacon.start();

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

  context.beacon.start();

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
      const status = useStatus(({ state }) => state);

      // Runs after the value subscribed, so starting notifies it while this effect is running.
      onMounted(() => {
        watchEffect(() => {
          effect.runs += 1;
          beacon.start();
        });
      });

      return status;
    },
    { beacon },
  );

  expect(value.value).toBe("running");

  beacon.stop();
  await nextTick();

  expect(value.value).toBe("stopped");
  expect(effect.runs).toBe(1);
});

test("a composable without a provider above it is misused", () => {
  expect(() => mount(() => useBeacon())).toThrow(BeaconError);
  expect(() => mount(() => useRunning())).toThrow(
    "useBeacon needs a BeaconProvider above it.",
  );
  expect(() => mount(() => useRoute("web"))).toThrow(BeaconError);
  expect(() => mount(() => useStatus())).toThrow(BeaconError);
  expect(() => mount(() => useSupport())).toThrow(BeaconError);
  expect(() => mount(() => useTransitions())).toThrow(BeaconError);
  expect(() => mount(() => useDisruption(draftEditor()))).toThrow(BeaconError);
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
      status: useStatus(({ state }) => state),
      route: useRoute("web", ({ observation }) => observation.status),
    }),
    { beacon },
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

test("the provider starts the session while mounted and ends it on unmount", () => {
  const { beacon } = createWebBeacon();
  const { unmount, warnings } = mount(() => null, { beacon, start: true });

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });

  unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
  expect(warnings).toEqual([]);
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
    { beacon, start: true },
  );

  await settle();

  expect(outcomes).not.toContain("failed");
});

test("the provider without start leaves the Beacon idle", () => {
  const { beacon } = createWebBeacon();
  const { unmount } = mount(() => null, { beacon });

  expect(beacon.status.get()).toEqual({ state: "idle" });

  unmount();

  expect(beacon.status.get()).toEqual({ state: "idle" });
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
});

test("the provider follows its beacon prop: the old session ends and the new one starts", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const beacon = shallowRef(first.beacon);

  const { unmount } = mount(() => null, { beacon, start: true });

  expect(first.beacon.status.get()).toMatchObject({ state: "running" });
  expect(second.beacon.status.get()).toEqual({ state: "idle" });

  beacon.value = second.beacon;
  await nextTick();

  expect(first.beacon.status.get()).toEqual({ state: "stopped" });
  expect(second.beacon.status.get()).toMatchObject({ state: "running" });

  unmount();

  expect(second.beacon.status.get()).toEqual({ state: "stopped" });
});

test("the provider ends only its own session and never disposes the Beacon", () => {
  const { beacon } = createWebBeacon();
  const { unmount } = mount(() => null, { beacon, start: true });

  unmount();

  expect(beacon.status.get().state).not.toBe("disposed");
  expect(beacon.start()).toBeTypeOf("function");
  expect(beacon.status.get()).toMatchObject({ state: "running" });
});

test("BIND-07 a provider that is mounted again starts a new session, and one session is left running with no check or command", () => {
  const { beacon, mock } = createWebBeacon();

  const first = mount(() => null, { beacon, start: true });

  first.unmount();

  expect(beacon.status.get()).toEqual({ state: "stopped" });

  const second = mount(() => null, { beacon, start: true });

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
    { beacon },
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
    { beacon },
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
    { beacon },
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
    { beacon },
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
