import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import {
  countListeners,
  fakeContainer,
  fakeRegistration,
  fakeWorker,
} from "src/fakeWorkers.fixture";
import type { FakeRegistration } from "src/fakeWorkers.fixture";
import { serviceWorker } from "src/serviceWorker";
import type { RegistrationLike } from "src/types/RegistrationLike";

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

// Lets every queued promise continuation run before the test goes on.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const createWorkerBeacon = (
  registration: FakeRegistration | undefined,
  options: Partial<Parameters<typeof serviceWorker>[0]> = {},
) => {
  const state = { registration };
  const container = fakeContainer(() => state.registration);
  const reloads = { count: 0 };

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => ({
        identity: {
          status: "known",
          authority: "com.example.notes",
          domain: "web-artifact",
          value: "web-build-b",
        },
        label: "Build web-build-b",
        raw: {},
      }),
    },
    routes: {
      worker: serviceWorker({
        container,
        target: {
          location: {
            reload: () => {
              reloads.count += 1;
            },
          },
        },
        ...options,
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, container, state, reloads, worker: beacon.route("worker") };
};

const updateReady = () =>
  fakeRegistration({ active: fakeWorker("activated"), waiting: fakeWorker() });

// A registration lookup that answers only when the test lets it.
const holdLookup = () => {
  const held: Array<(value: RegistrationLike | undefined) => void> = [];

  return {
    find: () =>
      new Promise<RegistrationLike | undefined>((resolve) => {
        held.push(resolve);
      }),
    release: (value: RegistrationLike | undefined) => {
      for (const resolve of held.splice(0)) {
        resolve(value);
      }
    },
  };
};

test("creating the route touches neither the container nor the registration", () => {
  const { container, state } = createWorkerBeacon(updateReady());

  expect(container.registrationReads()).toBe(0);
  expect(container.listeners()).toBe(0);
  expect(state.registration?.listeners()).toBe(0);
});

test("SW-02 starting reads the registration and shows the waiting worker as an update that is ready", async () => {
  const { beacon, worker } = createWorkerBeacon(updateReady());

  beacon.start();
  await settle();

  expect(worker.state.get().observation).toMatchObject({
    status: "available",
    offer: {
      release: {
        identity: { status: "unknown", reason: "worker-build-unknown" },
      },
    },
  });
  expect(worker.state.get().prepared).toEqual({
    status: "none",
    observedAt: 1_000,
  });
});

test("a check asks the browser for a newer script and reports what the workers say", async () => {
  const registration = fakeRegistration({ active: fakeWorker("activated") });
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  expect(worker.state.get().observation).toMatchObject({ status: "none" });

  const checking = worker.check();

  registration.found(fakeWorker());
  registration.install();

  await expect(checking).resolves.toMatchObject({ status: "succeeded" });
  expect(registration.updates()).toBe(1);
  expect(worker.state.get().observation).toMatchObject({ status: "available" });
});

test("a browser update check that fails fails the check and keeps what was observed", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const observed = worker.state.get().observation;

  registration.failNextUpdate(new Error("offline"));

  await expect(worker.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
  expect(worker.state.get().observation).toBe(observed);
});

test("a worker an update finds is reported as it installs, without a check", async () => {
  const registration = fakeRegistration({ active: fakeWorker("activated") });
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();
  registration.found(fakeWorker());

  expect(worker.state.get().observation).toMatchObject({
    status: "none",
    detail: "installing",
  });

  registration.install();

  expect(worker.state.get().observation).toMatchObject({ status: "available" });
});

test("SW-05 activating the waiting worker posts the skip-waiting message and proves no activation", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await expect(
    worker.activate({ offer: observation.offer.ref }),
  ).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: {
      kind: "activation-requested",
      worker: observation.offer.worker,
    },
  });
  expect(registration.waiting?.messages).toEqual([{ type: "SKIP_WAITING" }]);
  expect(worker.state.get().prepared).toMatchObject({ status: "none" });
});

test("the message the worker listens for is the application's", async () => {
  const registration = updateReady();

  const { beacon, worker } = createWorkerBeacon(registration, {
    message: { type: "ACTIVATE_NOW" },
  });

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await worker.activate({ offer: observation.offer.ref });

  expect(registration.waiting?.messages).toEqual([{ type: "ACTIVATE_NOW" }]);
});

test("SW-03 a waiting worker that changed without the route hearing of it is refused as stale", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  registration.waiting = fakeWorker();

  await expect(
    worker.activate({ offer: observation.offer.ref }),
  ).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(registration.waiting.messages).toEqual([]);
});

test("SW-03 an offer for a worker that a newer one replaced is refused as stale, though the route heard of the change", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  const replaced = registration.waiting;

  registration.found(fakeWorker());
  registration.install();
  replaced?.transition("redundant");

  expect(worker.state.get().observation).toMatchObject({
    status: "available",
  });

  await expect(
    worker.activate({ offer: observation.offer.ref }),
  ).resolves.toEqual({ status: "stale", reason: "replaced" });
  expect(registration.waiting?.messages).toEqual([]);
});

test("once the active worker is replaced the route has a prepared target, and a reload replaces the document", async () => {
  const registration = updateReady();
  const { beacon, worker, reloads } = createWorkerBeacon(registration);

  beacon.start();
  await settle();
  registration.activate();

  const { prepared } = worker.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  await expect(
    worker.reload({ prepared: prepared.value.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  expect(reloads.count).toBe(1);
});

test("a controller change is reported without waiting for a check", async () => {
  const registration = updateReady();
  const { beacon, worker, container } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  registration.waiting = null;
  registration.active = fakeWorker("activated");
  container.changeController();

  expect(worker.state.get().observation).toMatchObject({ status: "none" });
  expect(worker.state.get().prepared).toMatchObject({ status: "ready" });
});

test("without a registration an activation is unsupported", async () => {
  const registration = updateReady();
  const { beacon, worker, state } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  state.registration = undefined;

  await expect(
    worker.activate({ offer: observation.offer.ref }),
  ).resolves.toEqual({
    status: "unsupported",
    reason: "no-registration",
  });
});

test("a registration the application makes later is found by the next check", async () => {
  const { beacon, worker, state } = createWorkerBeacon(undefined);

  beacon.start();
  await settle();

  expect(worker.state.get().observation).toMatchObject({
    status: "none",
    detail: "no-registration",
  });

  state.registration = updateReady();
  await worker.check();

  expect(worker.state.get().observation).toMatchObject({ status: "available" });
});

test("a registration found by a check whose update fails is still observed", async () => {
  const { beacon, worker, state } = createWorkerBeacon(undefined);

  beacon.start();
  await settle();

  const registration = updateReady();

  state.registration = registration;
  registration.failNextUpdate(new Error("offline"));

  await expect(worker.check()).resolves.toMatchObject({ status: "failed" });

  registration.activate();

  expect(worker.state.get().prepared).toMatchObject({ status: "ready" });
});

test("a registration the application passes in is used without the container's", async () => {
  const given: RegistrationLike = updateReady();

  const { beacon, worker, container } = createWorkerBeacon(undefined, {
    registration: given,
  });

  beacon.start();
  await settle();

  expect(worker.state.get().observation).toMatchObject({ status: "available" });
  expect(container.registrationReads()).toBe(0);
});

test("a registration found by a function the application passes in is used", async () => {
  const found = updateReady();

  const { beacon, worker } = createWorkerBeacon(undefined, {
    registration: async () => found,
  });

  beacon.start();
  await settle();

  expect(worker.state.get().observation).toMatchObject({ status: "available" });
});

test("SW-13 stopping the session removes every listener from the registration, its workers and the container", async () => {
  const registration = updateReady();
  const { beacon, container } = createWorkerBeacon(registration);

  beacon.start();
  await settle();
  registration.found(fakeWorker());

  expect(countListeners(registration, container)).toBeGreaterThan(0);

  beacon.stop();

  expect(countListeners(registration, container)).toBe(0);
});

test("a change after the session stopped is not reported", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const before = worker.state.get();

  beacon.stop();
  registration.found(fakeWorker());

  expect(worker.state.get()).toBe(before);
});

test("without a container or a registration, as in a server render, the environment cannot say, and nothing is listened to", async () => {
  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes: { worker: serviceWorker() },
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();
  await settle();

  expect(beacon.route("worker").native.get()?.container).toBeNull();
  expect(beacon.route("worker").state.get().observation).toMatchObject({
    status: "unknown",
    reason: "unsupported-environment",
  });
  await expect(beacon.route("worker").check()).resolves.toMatchObject({
    status: "succeeded",
  });
  expect(beacon.route("worker").state.get().observation).toEqual({
    status: "unknown",
    reason: "unsupported-environment",
  });
  expect(beacon.route("worker").state.get().prepared).toEqual({
    status: "unknown",
  });
});

test("a registration the application holds is read even where the page has no container", async () => {
  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes: { worker: serviceWorker({ registration: updateReady() }) },
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();
  await settle();

  expect(beacon.route("worker").native.get()?.container).toBeNull();
  expect(beacon.route("worker").state.get().observation).toMatchObject({
    status: "available",
  });
});

test("without a window a reload is unsupported", async () => {
  const registration = updateReady();

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes: {
      worker: serviceWorker({ container: fakeContainer(() => registration) }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();
  await settle();
  registration.activate();

  const { prepared } = beacon.route("worker").state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  await expect(
    beacon.route("worker").reload({ prepared: prepared.value.ref }),
  ).resolves.toEqual({ status: "unsupported", reason: "no-document" });
});

test("the route declares a takeover for the activation and a document replacement for the reload", () => {
  const { worker } = createWorkerBeacon(undefined);

  expect(worker.capabilities).toEqual({
    activate: {
      reference: "offer",
      impacts: ["worker-takeover"],
      binding: "exact-instance",
    },
    reload: {
      reference: "prepared",
      impacts: ["document-replacement"],
      binding: "provider-current",
    },
  });
});

test("SW-04 a worker that becomes redundant during the activation request invents no activation", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await worker.activate({ offer: observation.offer.ref });

  const redundant = registration.waiting;

  registration.waiting = null;
  redundant?.transition("redundant");

  expect(worker.state.get().prepared).toMatchObject({ status: "none" });
  expect(worker.state.get().observation).toMatchObject({ status: "none" });
});

test("SW-07 a worker that activated has not reloaded the document, so the running web build is the old one", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();
  registration.activate();

  expect(worker.state.get().prepared).toMatchObject({ status: "ready" });
  expect(beacon.running.get().web).toMatchObject({
    state: "known",
    release: { identity: { value: "web-build-b" } },
  });
});

test("SW-07 while a worker activates, no observer sees a route with neither an update to activate nor a target to reload", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const seen: string[] = [];

  worker.state.subscribe(() => {
    const { observation, prepared } = worker.state.get();

    seen.push(`${observation.status} and ${prepared.status}`);
  });
  registration.activate();

  expect(seen).not.toHaveLength(0);
  expect(seen).not.toContain("none and none");
});

test("SW-14 reading the route, its capabilities and the diagnostics registers, updates and activates nothing", async () => {
  const registration = updateReady();
  const { beacon, worker, container } = createWorkerBeacon(registration);

  worker.state.get();
  worker.native.get();
  Object.keys(worker.capabilities);
  beacon.diagnostics.subscribe(() => {});
  beacon.diagnostics.events.subscribe(() => {});
  await settle();

  expect(container.registrationReads()).toBe(0);
  expect(registration.updates()).toBe(0);
  expect(registration.waiting?.messages).toEqual([]);
  expect(beacon.status.get()).toEqual({ state: "idle" });
});

test("LIFE-10 a registration the application owns keeps its own listeners when the session stops", async () => {
  const registration = updateReady();
  const { beacon } = createWorkerBeacon(registration);

  const own = () => {};

  registration.addEventListener("updatefound", own);
  beacon.start();
  await settle();

  expect(registration.listeners()).toBe(2);

  beacon.stop();

  expect(registration.listeners()).toBe(1);
});

test("SW-15 a page restored with another worker in control reconciles from the registration, and replays nothing", async () => {
  const registration = updateReady();
  const staleWaiting = registration.waiting;
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  // The page is frozen, and the browser changes the workers without a word to it.
  registration.waiting = null;
  registration.active = fakeWorker("activated");

  // Restored from the back-forward cache, the application starts the session again.
  beacon.stop();
  beacon.start();
  await settle();

  expect(worker.state.get().observation).toMatchObject({ status: "none" });

  await expect(
    worker.activate({ offer: observation.offer.ref }),
  ).resolves.toMatchObject({ status: "stale" });
  expect(staleWaiting?.messages).toEqual([]);
});

// Runs the action after the given number of turns of the microtask queue.
const afterTurns = (turns: number, action: () => void) => {
  if (turns === 0) {
    action();

    return;
  }

  queueMicrotask(() => {
    afterTurns(turns - 1, action);
  });
};

test("SEC-10 a session that ends at any turn while the registration is found posts no message after it ended", async () => {
  const postedAfterStop: string[] = [];

  for (let turns = 0; turns < 8; turns += 1) {
    const registration = updateReady();
    const lookup = holdLookup();

    const { beacon, worker } = createWorkerBeacon(undefined, {
      registration: lookup.find,
    });

    beacon.start();
    lookup.release(registration);
    await settle();

    const { observation } = worker.state.get();

    if (observation.status !== "available") {
      throw new Error("The route has no offer.");
    }

    const { waiting } = registration;

    if (waiting === null) {
      throw new Error("The registration has no waiting worker.");
    }

    const { postMessage } = waiting;

    waiting.postMessage = (message) => {
      if (beacon.status.get().state === "stopped") {
        postedAfterStop.push(`after ${turns} turns`);
      }

      postMessage(message);
    };

    const activating = worker.activate({ offer: observation.offer.ref });

    await settle();
    afterTurns(turns, () => {
      beacon.stop();
    });
    lookup.release(registration);
    await activating;
  }

  expect(postedAfterStop).toEqual([]);
});

test("SEC-10 a session that ends while the registration is resolved posts no message to a worker, and its wait ends unresolved", async () => {
  const registration = updateReady();
  const lookup = holdLookup();

  const { beacon, worker } = createWorkerBeacon(undefined, {
    registration: lookup.find,
  });

  beacon.start();
  lookup.release(registration);
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  const activating = worker.activate({ offer: observation.offer.ref });

  await settle();
  beacon.stop();
  lookup.release(registration);

  await expect(activating).resolves.toMatchObject({
    status: "indeterminate",
    reason: "aborted-after-dispatch",
  });
  await settle();

  expect(registration.waiting?.messages).toEqual([]);
  expect(worker.state.get().operation).toEqual({ state: "idle" });
});

test("a first installation that activates is no update, and the next real update prepares a target", async () => {
  const first = fakeWorker("installing");
  const registration = fakeRegistration({ active: null });
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  registration.found(first);
  registration.install();
  registration.activate();

  expect(worker.state.get().prepared).toMatchObject({ status: "none" });

  registration.found(fakeWorker("installing"));
  registration.install();
  registration.activate();

  expect(worker.state.get().prepared).toMatchObject({ status: "ready" });
});

test("a registration that vanished takes its offer with it", async () => {
  const registration = updateReady();
  const { beacon, worker, state } = createWorkerBeacon(registration);

  beacon.start();
  await settle();

  const { observation } = worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  state.registration = undefined;
  await worker.check();

  expect(worker.state.get().observation).toMatchObject({
    status: "none",
    detail: "no-registration",
  });
  await expect(
    worker.activate({ offer: observation.offer.ref }),
  ).resolves.toMatchObject({ status: "stale" });
});

test("SW-13 a session that ends while the registration is being found listens to nothing and reports nothing", async () => {
  const registration = updateReady();
  const lookup = holdLookup();

  const { beacon, worker, container } = createWorkerBeacon(undefined, {
    registration: lookup.find,
  });

  beacon.start();
  await settle();
  beacon.stop();

  const before = worker.state.get();

  lookup.release(registration);
  await settle();

  expect(countListeners(registration, container)).toBe(0);
  expect(worker.state.get()).toBe(before);
  expect(beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("SW-13 a check that ends with its session reports nothing and leaves no listener", async () => {
  const registration = updateReady();
  const { beacon, worker, container } = createWorkerBeacon(registration);

  beacon.start();
  await settle();
  registration.holdUpdates();

  const checking = worker.check();

  await settle();
  beacon.stop();
  registration.releaseUpdates();
  await checking;

  expect(countListeners(registration, container)).toBe(0);
  expect(beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("SW-13 a registration found for a check after its session ended is not listened to", async () => {
  const registration = updateReady();
  const lookup = holdLookup();

  const { beacon, worker, container } = createWorkerBeacon(undefined, {
    registration: lookup.find,
  });

  beacon.start();
  lookup.release(undefined);
  await settle();

  const checking = worker.check();

  await settle();
  beacon.stop();
  lookup.release(registration);
  await checking;

  expect(countListeners(registration, container)).toBe(0);
});

test("SW-13 a check whose session ended while the registration was being found asks the browser for no update", async () => {
  const registration = updateReady();
  const lookup = holdLookup();

  const { beacon, worker } = createWorkerBeacon(undefined, {
    registration: lookup.find,
  });

  beacon.start();
  lookup.release(undefined);
  await settle();

  const checking = worker.check();

  await settle();
  beacon.stop();
  lookup.release(registration);
  await checking;

  expect(registration.updates()).toBe(0);
});

test("a listener that stops the session while a change is reported leaves no late report", async () => {
  const registration = fakeRegistration({ active: fakeWorker("activated") });
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();
  worker.state.subscribe(() => {
    beacon.stop();
  });
  registration.found(fakeWorker());

  expect(beacon.status.get()).toEqual({ state: "stopped" });
  expect(beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("a listener that stops the session when the target is reported leaves the observation unreported", async () => {
  const registration = updateReady();
  const { beacon, worker } = createWorkerBeacon(registration);

  beacon.start();
  await settle();
  worker.state.subscribe(() => {
    beacon.stop();
  });
  registration.activate();

  expect(beacon.status.get()).toEqual({ state: "stopped" });
  expect(worker.state.get().prepared).toMatchObject({ status: "ready" });
  expect(worker.state.get().observation).toMatchObject({ status: "available" });
  expect(beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});
