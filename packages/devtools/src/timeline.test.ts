import { fireEvent, within } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";

import { createLabBeacon } from "src/beacon.fixture";
import { createEmittingBeacon } from "src/emittingBeacon.fixture";
import { formatEventTime } from "src/formatting/formatEventTime";
import { mountDevtools, settle } from "src/mountDevtools.fixture";
import { stubClipboard } from "src/stubClipboard.fixture";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.useRealTimers();
});

const mountEmitting = (options: { maxEvents?: number } = {}) => {
  const lab = createLabBeacon();
  const emitting = createEmittingBeacon(lab.beacon);

  const mounted = mountDevtools({
    beacon: emitting.beacon,
    initialIsOpen: true,
    ...options,
  });

  return { ...mounted, ...emitting, lab };
};

type Mounted = ReturnType<typeof mountEmitting>;

const rows = ({ view }: Mounted) =>
  Array.from(
    view()
      .queryByLabelText("Event timeline")
      ?.querySelectorAll<HTMLElement>(".event") ?? [],
  );

const firstRow = (mounted: Mounted) => {
  const [row] = rows(mounted);

  if (row === undefined) {
    throw new Error("Expected a row");
  }

  return row;
};

const summaryOf = (row: HTMLElement) => {
  const summary = row.querySelector<HTMLElement>(".event-summary");

  if (summary === null) {
    throw new Error("Expected a summary");
  }

  return summary;
};

const cells = (row: Element) =>
  Array.from(
    row.querySelector(".event-summary")?.children ?? [],
    (cell) => cell.textContent ?? "",
  ).slice(0, 8);

const types = (mounted: Mounted) => rows(mounted).map((row) => cells(row)[1]);

const chips = ({ view }: Mounted) =>
  within(view().getByRole("group", { name: "Event types" }));

test("a row shows the local time, the type, the session, the route, the command, the attempt, the operation and the reason", async () => {
  const mounted = mountEmitting();

  mounted.emit({
    type: "command-settled",
    timestamp: 1_700_000_000_123,
    session: 2,
    route: "web",
    command: "reload",
    attempt: 3,
    operation: 7,
    reason: "obsolete",
  });
  await settle();

  const row = firstRow(mounted);

  expect(cells(row)).toEqual([
    formatEventTime(1_700_000_000_123),
    "command-settled",
    "2",
    "web",
    "reload",
    "3",
    "7",
    "obsolete",
  ]);
  expect(row.querySelector("time")?.getAttribute("title")).toBe(
    "2023-11-14T22:13:20.123Z",
  );
  expect(row.querySelector("time")?.getAttribute("datetime")).toBe(
    "2023-11-14T22:13:20.123Z",
  );

  // An event of no session and no route leaves its cells empty.
  mounted.emit({ type: "disposed", session: null });
  await settle();
  expect(cells(rows(mounted)[0] ?? row).slice(2)).toEqual([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  mounted.devtools.unmount();
});

test("events are listed newest first", async () => {
  const mounted = mountEmitting();

  mounted.emit({ type: "session-started" });
  mounted.emit({ type: "check-requested" });
  mounted.emit({ type: "read-accepted" });
  await settle();

  expect(types(mounted)).toEqual([
    "read-accepted",
    "check-requested",
    "session-started",
  ]);
  mounted.devtools.unmount();
});

test("one chip per recorded type filters one type at a time, and All shows everything again", async () => {
  const mounted = mountEmitting();

  mounted.emit({ type: "read-started" });
  mounted.emit({ type: "read-started" });
  mounted.emit({ type: "read-failed" });
  mounted.emit({ type: "session-started" });
  await settle();

  expect(
    chips(mounted)
      .getAllByRole("button")
      .map((chip) => chip.textContent),
  ).toEqual(["All 4", "read-failed 1", "read-started 2", "session-started 1"]);
  expect(
    chips(mounted).getByRole("button", { name: "read-failed 1" }).dataset[
      "failure"
    ],
  ).toBe("true");
  expect(
    chips(mounted).getByRole("button", { name: "read-started 2" }).dataset[
      "failure"
    ],
  ).toBe("false");

  fireEvent.click(
    chips(mounted).getByRole("button", { name: "read-started 2" }),
  );
  expect(types(mounted)).toEqual(["read-started", "read-started"]);
  expect(
    chips(mounted)
      .getByRole("button", { name: "read-started 2" })
      .getAttribute("aria-pressed"),
  ).toBe("true");

  // One type at a time: another chip replaces the first.
  fireEvent.click(
    chips(mounted).getByRole("button", { name: "read-failed 1" }),
  );
  expect(types(mounted)).toEqual(["read-failed"]);

  fireEvent.click(chips(mounted).getByRole("button", { name: "All 4" }));
  expect(types(mounted)).toHaveLength(4);
  mounted.devtools.unmount();
});

test("the selected type keeps its chip after a clear, so the filter that hides everything stays in view", async () => {
  const mounted = mountEmitting();

  mounted.emit({ type: "read-started" });
  mounted.emit({ type: "read-failed" });
  await settle();

  fireEvent.click(
    chips(mounted).getByRole("button", { name: "read-started 1" }),
  );
  fireEvent.click(mounted.view().getByRole("button", { name: "Clear" }));
  await settle();

  expect(
    chips(mounted)
      .getAllByRole("button")
      .map((chip) => chip.textContent),
  ).toEqual(["All 0", "read-started 0"]);
  expect(
    chips(mounted)
      .getByRole("button", { name: "read-started 0" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(mounted.view().getByText("No matching events")).toBeTruthy();

  fireEvent.click(chips(mounted).getByRole("button", { name: "All 0" }));
  expect(chips(mounted).getAllByRole("button")).toHaveLength(1);
  expect(mounted.view().getByText("Waiting for events")).toBeTruthy();
  mounted.devtools.unmount();
});

test("the search matches the type, the route, the command, the reason, the session, the attempt and the operation, ignoring case and spaces around", async () => {
  const mounted = mountEmitting();

  mounted.emit({ type: "check-requested", route: "web", reason: "Manual" });
  mounted.emit({
    type: "command-admitted",
    route: "ota",
    command: "download",
    session: 4,
    attempt: 2,
    operation: 9,
  });
  mounted.emit({ type: "session-stopped", session: 4 });
  await settle();

  const search = () =>
    mounted.view().getByRole("searchbox", { name: "Filter events" });

  const find = async (query: string) => {
    fireEvent.input(search(), { target: { value: query } });
    await settle();

    return types(mounted);
  };

  expect(await find("  MANUAL ")).toEqual(["check-requested"]);
  expect(await find("download")).toEqual(["command-admitted"]);
  expect(await find("ota")).toEqual(["command-admitted"]);
  expect(await find("session-stopped")).toEqual(["session-stopped"]);
  expect(await find("session 4")).toEqual([
    "session-stopped",
    "command-admitted",
  ]);
  expect(await find("attempt 2")).toEqual(["command-admitted"]);
  expect(await find("operation 9")).toEqual(["command-admitted"]);
  expect(await find("")).toHaveLength(3);

  expect(await find("nothing matches this")).toEqual([]);
  expect(mounted.view().getByText("No matching events")).toBeTruthy();
  expect(mounted.view().getByText("0 / 3")).toBeTruthy();

  fireEvent.click(
    mounted.view().getByRole("button", { name: "Clear filters" }),
  );
  expect(types(mounted)).toHaveLength(3);
  expect(search()).toHaveProperty("value", "");
  mounted.devtools.unmount();
});

test("selecting a route keeps its own events and those of no route, and drops another route's", async () => {
  const mounted = mountEmitting();

  mounted.emit({ type: "session-started" });
  mounted.emit({ type: "check-requested", route: "web" });
  mounted.emit({ type: "check-requested", route: "ota" });
  mounted.emit({ type: "read-failed", route: "web" });
  await settle();

  fireEvent.click(mounted.view().getByRole("button", { name: /^web/ }));
  expect(types(mounted)).toEqual([
    "read-failed",
    "check-requested",
    "session-started",
  ]);

  fireEvent.click(mounted.view().getByRole("button", { name: /^ota/ }));
  expect(types(mounted)).toEqual(["check-requested", "session-started"]);

  fireEvent.click(mounted.view().getByRole("button", { name: /^Overview/ }));
  expect(types(mounted)).toHaveLength(4);
  mounted.devtools.unmount();
});

test("pausing stops the recording and releases the subscription, resuming records again, and clearing forgets everything", async () => {
  const mounted = mountEmitting();

  mounted.emit({ type: "session-started" });
  await settle();
  expect(mounted.listeners()).toBe(1);

  fireEvent.click(mounted.view().getByRole("button", { name: "Pause" }));
  expect(mounted.listeners()).toBe(0);
  expect(
    mounted
      .view()
      .getByRole("button", { name: "Resume" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  mounted.emit({ type: "check-requested" });
  await settle();
  expect(types(mounted)).toEqual(["session-started"]);

  fireEvent.click(mounted.view().getByRole("button", { name: "Clear" }));
  await settle();
  expect(types(mounted)).toEqual([]);
  expect(mounted.view().getByText("Recording paused")).toBeTruthy();

  fireEvent.click(mounted.view().getByRole("button", { name: "Resume" }));
  expect(mounted.listeners()).toBe(1);
  expect(mounted.view().getByText("Waiting for events")).toBeTruthy();

  mounted.emit({ type: "read-accepted" });
  await settle();
  expect(types(mounted)).toEqual(["read-accepted"]);
  mounted.devtools.unmount();
});

test("a row expands into the whole record only while it is open, and its copy button copies exactly that text", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  const clipboard = stubClipboard();
  const mounted = mountEmitting();

  mounted.emit({
    type: "route-failed",
    timestamp: 1_700_000_000_123,
    session: 2,
    route: "web",
    attempt: 1,
    reason: "SOURCE_FAILED",
  });
  await Promise.resolve();
  await Promise.resolve();

  const row = firstRow(mounted);

  expect(row.querySelector(".context")).toBeNull();
  expect(
    row.querySelector(".event-summary")?.getAttribute("aria-expanded"),
  ).toBe("false");

  fireEvent.click(summaryOf(row));

  const expected = JSON.stringify(
    {
      type: "route-failed",
      time: "2023-11-14T22:13:20.123Z",
      session: 2,
      route: "web",
      command: null,
      attempt: 1,
      operation: null,
      reason: "SOURCE_FAILED",
    },
    null,
    2,
  );

  expect(row.querySelector("pre")?.textContent).toBe(expected);

  const copy = within(row).getByRole("button", { name: "Copy" });

  fireEvent.click(copy);
  await Promise.resolve();
  await Promise.resolve();
  expect(clipboard.writes).toEqual([expected]);
  expect(copy.textContent).toBe("Copied");

  vi.advanceTimersByTime(1_199);
  expect(copy.textContent).toBe("Copied");
  vi.advanceTimersByTime(1);
  expect(copy.textContent).toBe("Copy");

  fireEvent.click(summaryOf(row));
  expect(row.querySelector(".context")).toBeNull();
  mounted.devtools.unmount();
  clipboard.restore();
});

test("copying again while it says Copied starts the moment over, and a button that goes leaves no timer behind", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  const clipboard = stubClipboard();
  const mounted = mountEmitting();

  mounted.emit({ type: "session-started" });
  await Promise.resolve();
  await Promise.resolve();

  const row = firstRow(mounted);

  fireEvent.click(summaryOf(row));

  const copy = within(row).getByRole("button", { name: "Copy" });

  const press = async () => {
    fireEvent.click(copy);
    await Promise.resolve();
    await Promise.resolve();
  };

  await press();
  vi.advanceTimersByTime(1_000);
  await press();
  expect(clipboard.writes).toHaveLength(2);

  // The first press would have ended at 1200 milliseconds; the second holds it until 2200.
  vi.advanceTimersByTime(1_199);
  expect(copy.textContent).toBe("Copied");
  vi.advanceTimersByTime(1);
  expect(copy.textContent).toBe("Copy");

  await press();
  expect(vi.getTimerCount()).toBe(1);
  mounted.devtools.unmount();
  expect(vi.getTimerCount()).toBe(0);
  clipboard.restore();
});

test("copying does nothing where there is no clipboard", async () => {
  const mounted = mountEmitting();

  mounted.emit({ type: "session-started" });
  await settle();

  const row = firstRow(mounted);

  fireEvent.click(summaryOf(row));

  const copy = within(row).getByRole("button", { name: "Copy" });

  fireEvent.click(copy);
  await settle();
  expect(copy.textContent).toBe("Copy");
  mounted.devtools.unmount();
});

test("an event is copied when it arrives: its text is cut to a limit and it keeps no reference to what was told", async () => {
  const mounted = mountEmitting();

  const sent = mounted.emit({
    type: "route-failed",
    reason: "x".repeat(5_000),
    route: "y".repeat(400),
  });

  await settle();
  Object.assign(sent, { reason: "changed later", type: "disposed" });
  await settle();

  const row = firstRow(mounted);
  const [, type, , route, , , , reason] = cells(row);

  expect(type).toBe("route-failed");
  expect(reason?.length).toBeLessThan(260);
  expect(reason?.startsWith("xxxx")).toBe(true);
  expect(reason?.endsWith("[Truncated]")).toBe(true);
  expect(route?.length).toBeLessThan(260);

  fireEvent.click(summaryOf(row));
  expect(row.querySelector("pre")?.textContent).not.toContain("changed later");
  expect((row.querySelector("pre")?.textContent ?? "").length).toBeLessThan(
    900,
  );
  mounted.devtools.unmount();
});

test("a field that is not what an event promises is dropped instead of shown, and nothing else of the event is kept", async () => {
  const mounted = mountEmitting();
  const extra = { token: "leaked-token", payload: { cookie: "leaked-cookie" } };

  mounted.emit({
    type: "route-failed",
    timestamp: Number.NaN,
    session: Number.POSITIVE_INFINITY,
    attempt: Number.NaN,
    ...extra,
  });
  await settle();

  const row = firstRow(mounted);

  expect(cells(row)).toEqual([
    "invalid time",
    "route-failed",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  fireEvent.click(summaryOf(row));
  expect(row.querySelector("pre")?.textContent).toContain(
    '"time": "invalid time"',
  );
  expect(mounted.text()).not.toContain("leaked");
  mounted.devtools.unmount();
});

test("a route's own events arrive from the real Beacon through the same timeline", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  lab.answer();
  lab.beacon.start();
  await lab.beacon.check({ reason: "startup" });
  await settle();

  const listed = Array.from(
    view().getByLabelText("Event timeline").querySelectorAll(".event-type"),
    (type) => type.textContent,
  );

  expect(listed).toContain("session-started");
  expect(listed).toContain("check-requested");
  expect(listed).toContain("read-accepted");
  expect(listed).toContain("running-read");
  devtools.unmount();
});
