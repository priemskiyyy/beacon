import { settle } from "@priemskiyyy/beacon/mock";
import { fireEvent, within } from "@testing-library/dom";
import { afterEach, expect, test } from "vitest";

import { createLabBeacon, quietDocument } from "src/beacon.fixture";
import { mountDevtools } from "src/mountDevtools.fixture";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

const header = (view: ReturnType<typeof mountDevtools>["view"]) =>
  view().getByRole("banner");

test("the header follows the session: idle, running with its number, stopped and disposed", async () => {
  const { beacon } = createLabBeacon();
  const { devtools, view } = mountDevtools({ beacon, initialIsOpen: true });

  expect(header(view).textContent).toContain("idle");

  const stop = beacon.start();

  await settle();
  expect(header(view).textContent).toContain("running, session 1");

  stop();
  await settle();
  expect(header(view).textContent).toContain("stopped");

  beacon.start();
  await settle();
  expect(header(view).textContent).toContain("running, session 2");

  beacon.dispose();
  await settle();
  expect(header(view).textContent).toContain("disposed");
  devtools.unmount();
});

test("the counters show what Beacon dropped, and go red when one is not zero", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  const counters = () =>
    within(header(view)).getByRole("group", { name: "Diagnostic counters" });

  expect(counters().textContent).toBe(
    "late callbacks 0listener errors 0cleanup errors 0",
  );
  expect(counters().querySelectorAll('[data-alert="true"]')).toHaveLength(0);

  lab.beacon.start();
  lab.beacon.check();
  await settle();
  // The answer of a read that outlived its session is dropped and counted.
  lab.beacon.stop();
  lab.mock.resolve({ document: quietDocument() });
  await settle();

  expect(lab.beacon.diagnostics.get().counters.lateCallbacks).toBeGreaterThan(
    0,
  );
  expect(counters().textContent).toContain(
    `late callbacks ${lab.beacon.diagnostics.get().counters.lateCallbacks}`,
  );
  expect(
    counters().querySelector('[data-alert="true"]')?.textContent,
  ).toContain("late callbacks");
  devtools.unmount();
});

test("Check now asks once with the reason manual, needs a running session, never starts one and is off while a check runs", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  const button = () => view().getByRole("button", { name: "Check now" });

  // No session: the action is off, and pressing it anyway reads nothing.
  expect(button()).toHaveProperty("disabled", true);
  fireEvent.click(button());
  await settle();
  expect(lab.mock.stats().reads).toBe(0);
  expect(lab.beacon.status.get()).toEqual({ state: "idle" });

  lab.beacon.start();
  await settle();
  expect(button()).toHaveProperty("disabled", false);

  fireEvent.click(button());
  await settle();

  // Held: one check is in flight, and a second press cannot add another.
  expect(button()).toHaveProperty("disabled", true);
  fireEvent.click(button());
  await settle();
  expect(lab.mock.stats()).toMatchObject({ reads: 1, held: 1 });

  lab.mock.resolve({ document: quietDocument() });
  await settle();

  expect(button()).toHaveProperty("disabled", false);
  expect(lab.mock.stats().reads).toBe(1);

  const requests = view()
    .getByLabelText("Event timeline")
    .querySelectorAll(".event");

  const requested = Array.from(requests).filter((row) =>
    row.textContent?.includes("check-started"),
  );

  expect(requested).toHaveLength(3);
  expect(requested.every((row) => row.textContent?.includes("manual"))).toBe(
    true,
  );
  // The one action never calls a command.
  expect(lab.commands).toEqual({ reloads: 0, prefetches: 0, downloads: 0 });
  devtools.unmount();
});

test("the panel does not offer to check a session that stopped", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  const stop = lab.beacon.start();

  await settle();
  stop();
  await settle();

  expect(view().getByRole("button", { name: "Check now" })).toHaveProperty(
    "disabled",
    true,
  );
  devtools.unmount();
});
