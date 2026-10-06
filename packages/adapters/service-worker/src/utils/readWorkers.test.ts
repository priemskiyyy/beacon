import { expect, test } from "vitest";

import { fakeRegistration, fakeWorker } from "src/fakeWorkers.fixture";
import { getWorkerId } from "src/utils/getWorkerId";
import { readWorkers } from "src/utils/readWorkers";

test("SW-01 without a registration there is nothing to update", () => {
  expect(readWorkers(undefined, null)).toEqual({
    observation: {
      status: "none",
      reason: "no-decision",
      detail: "no-registration",
    },
    prepared: { status: "none" },
  });
});

test("SW-02 the first installation is not an update, even when it waits", () => {
  const registration = fakeRegistration({ waiting: fakeWorker() });

  expect(readWorkers(registration, null).observation).toEqual({
    status: "none",
    reason: "no-decision",
    detail: "first-install",
  });
});

test("SW-03 a waiting worker next to an active one is an update that is ready, whose build is unknown", () => {
  const waiting = fakeWorker();

  const registration = fakeRegistration({
    active: fakeWorker("activated"),
    waiting,
  });

  const { observation } = readWorkers(registration, registration.active);

  expect(observation).toEqual({
    status: "available",
    offer: {
      release: {
        identity: { status: "unknown", reason: "worker-build-unknown" },
      },
      worker: { id: getWorkerId(waiting) },
    },
  });
});

test("SW-04 a worker that is still installing is not ready to activate", () => {
  const registration = fakeRegistration({ active: fakeWorker("activated") });

  registration.found(fakeWorker());

  expect(readWorkers(registration, registration.active).observation).toEqual({
    status: "none",
    reason: "no-decision",
    detail: "installing",
  });
});

test("an idle registration has no update and nothing prepared", () => {
  const registration = fakeRegistration({ active: fakeWorker("activated") });

  expect(readWorkers(registration, registration.active)).toEqual({
    observation: { status: "none", reason: "no-decision", detail: null },
    prepared: { status: "none" },
  });
});

test("SW-05 a skip-waiting request alone prepares nothing until the active worker was replaced", () => {
  const registration = fakeRegistration({
    active: fakeWorker("activated"),
    waiting: fakeWorker(),
  });

  const initial = registration.active;

  expect(readWorkers(registration, initial).prepared).toEqual({
    status: "none",
  });

  registration.activate();

  expect(readWorkers(registration, initial).prepared).toEqual({
    status: "ready",
    value: {
      release: {
        identity: { status: "unknown", reason: "worker-build-unknown" },
      },
      worker: { id: getWorkerId(registration.active ?? fakeWorker()) },
    },
  });
});

test("SW-06 a worker that activates after a first installation is not a prepared update", () => {
  const registration = fakeRegistration({ waiting: fakeWorker() });

  registration.activate();

  expect(readWorkers(registration, null).prepared).toEqual({ status: "none" });
});

test("a worker keeps its id wherever it is read from", () => {
  const worker = fakeWorker();

  expect(getWorkerId(worker)).toBe(getWorkerId(worker));
  expect(getWorkerId(fakeWorker())).not.toBe(getWorkerId(worker));
});
