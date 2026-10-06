import type { BeaconDiagnosticEventType } from "@priemskiyyy/beacon";
import { fireEvent } from "@testing-library/dom";
import { afterEach, expect, test } from "vitest";

import { createLabBeacon } from "src/beacon.fixture";
import { createEmittingBeacon } from "src/emittingBeacon.fixture";
import { mountDevtools, settle } from "src/mountDevtools.fixture";
import { EVENT_FAILURES } from "src/utils/constants/events";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

const mountClosed = () => {
  const lab = createLabBeacon();
  const emitting = createEmittingBeacon(lab.beacon);
  const mounted = mountDevtools({ beacon: emitting.beacon });

  const launcher = () =>
    mounted.view().getByRole("button", { name: "Open Beacon devtools" });

  const dot = () =>
    launcher().querySelector(".dot")?.getAttribute("data-state");

  return { ...mounted, ...emitting, lab, launcher, dot };
};

const FAILURES: BeaconDiagnosticEventType[] = [
  "route-failed",
  "policy-failed",
  "journal-failed",
  "running-failed",
  "read-failed",
  "listener-error",
  "cleanup-error",
  "late-callback",
];

const NON_FAILURES: BeaconDiagnosticEventType[] = [
  "session-started",
  "session-stopped",
  "disposed",
  "running-read",
  "check-started",
  "journal-read",
  "journal-ignored",
  "ready-reported",
  "command-admitted",
  "command-settled",
  "read-started",
  "read-accepted",
  "read-renewed",
  "read-abandoned",
];

test("the launcher says where the session stands", async () => {
  const { lab, dot, devtools } = mountClosed();

  expect(dot()).toBe("idle");

  const stop = lab.beacon.start();

  await settle();
  expect(dot()).toBe("running");

  stop();
  await settle();
  expect(dot()).toBe("stopped");

  lab.beacon.dispose();
  await settle();
  expect(dot()).toBe("disposed");
  devtools.unmount();
});

test("each failure event that arrives while the panel is closed turns the launcher red, and opening it and closing it again clears that", async () => {
  const closed = mountClosed();

  // Every type of Beacon is decided one way or the other.
  expect(Object.keys(EVENT_FAILURES)).toHaveLength(
    FAILURES.length + NON_FAILURES.length,
  );
  expect(
    Object.entries(EVENT_FAILURES).flatMap(([type, failure]) => {
      if (!failure) {
        return [];
      }

      return [type];
    }),
  ).toEqual(expect.arrayContaining(FAILURES));

  for (const type of FAILURES) {
    expect(closed.dot()).toBe("idle");

    closed.emit({ type });
    await settle();
    expect(closed.dot(), type).toBe("failure");

    fireEvent.click(closed.launcher());
    fireEvent.click(
      closed.view().getByRole("button", { name: "Close devtools" }),
    );
    expect(closed.dot(), type).toBe("idle");
  }

  closed.devtools.unmount();
});

test("no other event turns the launcher red", async () => {
  const closed = mountClosed();

  for (const type of NON_FAILURES) {
    closed.emit({ type });
  }

  await settle();
  expect(closed.dot()).toBe("idle");
  closed.devtools.unmount();
});

test("a failure that arrived while the panel was open is not new when it closes, and the next one is", async () => {
  const closed = mountClosed();

  fireEvent.click(closed.launcher());
  closed.emit({ type: "route-failed" });
  await settle();
  fireEvent.click(
    closed.view().getByRole("button", { name: "Close devtools" }),
  );
  expect(closed.dot()).toBe("idle");

  closed.emit({ type: "read-failed" });
  await settle();
  expect(closed.dot()).toBe("failure");
  closed.devtools.unmount();
});

test("clearing the timeline does not make an old failure new, and the launcher is red only for failures after it closed", async () => {
  const closed = mountClosed();

  closed.emit({ type: "policy-failed" });
  await settle();
  expect(closed.dot()).toBe("failure");

  fireEvent.click(closed.launcher());
  fireEvent.click(closed.view().getByRole("button", { name: "Clear" }));
  await settle();
  fireEvent.click(
    closed.view().getByRole("button", { name: "Close devtools" }),
  );
  expect(closed.dot()).toBe("idle");

  closed.emit({ type: "session-started" });
  await settle();
  expect(closed.dot()).toBe("idle");
  closed.devtools.unmount();
});

test("the launcher opens the panel and moves focus into it", () => {
  const closed = mountClosed();

  expect(closed.host.shadowRoot?.activeElement).toBeNull();
  fireEvent.click(closed.launcher());
  expect(closed.host.shadowRoot?.activeElement).toBe(
    closed.view().getByRole("complementary", { name: "Beacon devtools" }),
  );
  closed.devtools.unmount();
});

test("a real failure of a route turns the launcher red", async () => {
  const lab = createLabBeacon();
  const { devtools, view } = mountDevtools({ beacon: lab.beacon });

  const dot = () =>
    view()
      .getByRole("button", { name: "Open Beacon devtools" })
      .querySelector(".dot")
      ?.getAttribute("data-state");

  lab.beacon.start();
  await settle();
  expect(dot()).toBe("running");

  const checking = lab.beacon.check();

  await settle();
  lab.mock.reject(new Error("offline"));
  await checking;
  await settle();

  expect(dot()).toBe("failure");
  devtools.unmount();
});
