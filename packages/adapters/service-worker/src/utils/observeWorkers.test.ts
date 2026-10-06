import { expect, test } from "vitest";

import { fakeRegistration, fakeWorker } from "src/fakeWorkers.fixture";
import { observeWorkers } from "src/utils/observeWorkers";

test("observeWorkers reports a state change of any worker it found", () => {
  const registration = fakeRegistration({
    active: fakeWorker("activated"),
    waiting: fakeWorker(),
  });

  const heard = { count: 0 };

  const stop = observeWorkers(registration, () => {
    heard.count += 1;
  });

  registration.waiting?.transition("activating");
  registration.active?.transition("redundant");

  expect(heard.count).toBe(2);
  stop();
});

test("observeWorkers follows a worker that an update finds", () => {
  const registration = fakeRegistration({ active: fakeWorker("activated") });
  const heard = { count: 0 };

  observeWorkers(registration, () => {
    heard.count += 1;
  });

  const found = fakeWorker();

  registration.found(found);
  expect(heard.count).toBe(1);

  registration.install();
  expect(heard.count).toBe(2);
  expect(found.listeners()).toBe(1);
});

test("observeWorkers listens to a worker once, however often it is announced", () => {
  const registration = fakeRegistration({ active: fakeWorker("activated") });
  const found = fakeWorker();

  observeWorkers(registration, () => {});
  registration.found(found);
  registration.found(found);

  expect(found.listeners()).toBe(1);
});

test("observeWorkers stops listening to the registration and every worker", () => {
  const registration = fakeRegistration({
    active: fakeWorker("activated"),
    waiting: fakeWorker(),
  });

  const found = fakeWorker();
  const stop = observeWorkers(registration, () => {});

  registration.found(found);
  stop();

  expect(registration.listeners()).toBe(0);
  expect(registration.active?.listeners()).toBe(0);
  expect(registration.waiting?.listeners()).toBe(0);
  expect(found.listeners()).toBe(0);
});
