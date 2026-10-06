import { fireEvent, within } from "@testing-library/dom";
import { afterEach, expect, test } from "vitest";

import { buildDocument, createLabBeacon } from "src/beacon.fixture";
import { formatDateTime } from "src/formatting/formatDateTime";
import { mountDevtools, settle } from "src/mountDevtools.fixture";
import { withRoutes } from "src/withRoutes.fixture";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

type View = ReturnType<typeof mountDevtools>["view"];

const sidebar = (view: View) =>
  view().getByRole("navigation", { name: "Beacon routes" });

const rowOf = (view: View, name: string) =>
  within(sidebar(view)).getByRole("button", { name: new RegExp(`^${name}`) });

const detail = (view: View) =>
  view().getByRole("region", { name: "Selected route" });

const sectionOf = (view: View, title: string) =>
  within(detail(view)).getByRole("region", { name: title });

const fieldOf = (section: HTMLElement, label: string) => {
  const field = Array.from(section.querySelectorAll(".field")).find(
    (candidate) => candidate.querySelector("dt")?.textContent === label,
  );

  return field?.querySelector("dd")?.textContent ?? null;
};

const startAndCheck = async (lab: ReturnType<typeof createLabBeacon>) => {
  lab.answer(buildDocument());
  lab.beacon.start();
  await lab.beacon.check({ reason: "startup" });
  await settle();
};

test("the sidebar lists one row per route in the order they were defined, with what each one has observed", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  const names = () =>
    Array.from(
      sidebar(view).querySelectorAll(".row-title"),
      (title) => title.textContent,
    );

  expect(names()).toEqual(["Overview", "web", "binary", "ota"]);
  expect(rowOf(view, "web").textContent).toContain("unknown");
  expect(rowOf(view, "web").textContent).toContain(
    "check idle · operation idle · prepared not-applicable",
  );
  expect(rowOf(view, "ota").textContent).toContain("prepared unknown");

  await startAndCheck(lab);

  expect(rowOf(view, "web").textContent).toContain("available");
  expect(rowOf(view, "web").textContent).toContain("check succeeded");
  expect(rowOf(view, "binary").textContent).toContain("available");
  expect(rowOf(view, "ota").textContent).toContain("available");
  devtools.unmount();
});

test("a failed check shows its error code in the row and leaves what was accepted", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  await startAndCheck(lab);
  lab.mock.hold();

  const checking = lab.beacon.check();

  await settle();
  expect(rowOf(view, "web").textContent).toContain("check checking, attempt 2");

  lab.mock.reject(new Error("offline"));
  await checking;
  await settle();

  expect(rowOf(view, "web").textContent).toContain(
    "check failed, SOURCE_FAILED",
  );
  expect(rowOf(view, "web").textContent).toContain("available");
  expect(rowOf(view, "web").querySelector("small")?.dataset["check"]).toBe(
    "failed",
  );

  fireEvent.click(rowOf(view, "web"));
  expect(fieldOf(sectionOf(view, "Last check"), "State")).toBe("failed");
  expect(fieldOf(sectionOf(view, "Last check"), "Error")).toBe("SOURCE_FAILED");
  expect(fieldOf(sectionOf(view, "Observation"), "Status")).toBe("available");
  devtools.unmount();
});

test("the operation of a route shows running, then indeterminate until it is acknowledged", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  await startAndCheck(lab);

  const web = lab.beacon.route("web");
  const { observation } = web.state.get();

  if (observation.status !== "available") {
    throw new Error("Expected an offer on the web route.");
  }

  const reload = web.reload({ offer: observation.offer.ref });

  await settle();
  expect(rowOf(view, "web").textContent).toContain("operation running reload");

  fireEvent.click(rowOf(view, "web"));
  expect(fieldOf(sectionOf(view, "Operation"), "State")).toBe("running");
  expect(fieldOf(sectionOf(view, "Operation"), "Command")).toBe("reload");
  expect(fieldOf(sectionOf(view, "Operation"), "Progress")).toBe(
    "not reported",
  );

  lab.settleReload({ status: "indeterminate", reason: "connection lost" });
  await reload;
  await settle();

  expect(rowOf(view, "web").textContent).toContain(
    "operation indeterminate reload",
  );
  expect(fieldOf(sectionOf(view, "Operation"), "State")).toBe("indeterminate");
  expect(fieldOf(sectionOf(view, "Operation"), "Reason")).toBe(
    "connection lost",
  );

  web.acknowledge();
  await settle();
  expect(rowOf(view, "web").textContent).toContain("operation idle");
  devtools.unmount();
});

test("the prepared state of a provider route shows what it reports ready", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  await startAndCheck(lab);
  lab.prepare();
  await settle();

  expect(rowOf(view, "ota").textContent).toContain(
    "prepared ready, ota-7 (com.example.notes, ota-update)",
  );

  fireEvent.click(rowOf(view, "ota"));
  expect(fieldOf(sectionOf(view, "Prepared"), "Status")).toBe("ready");
  expect(fieldOf(sectionOf(view, "Prepared"), "Identity")).toBe(
    "ota-7 (com.example.notes, ota-update)",
  );
  expect(fieldOf(sectionOf(view, "Prepared"), "Label")).toBe("Update seven");
  devtools.unmount();
});

test("the detail of a route shows its observation with evidence, its offer, its check and what its commands declare", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  fireEvent.click(rowOf(view, "web"));
  expect(fieldOf(sectionOf(view, "Observation"), "Status")).toBe("unknown");
  expect(fieldOf(sectionOf(view, "Observation"), "Reason")).toBe("not-checked");
  expect(within(sectionOf(view, "Offer")).getByText("No offer.")).toBeTruthy();

  await startAndCheck(lab);

  const observation = sectionOf(view, "Observation");

  expect(fieldOf(observation, "Status")).toBe("available");
  expect(fieldOf(observation, "Source")).toBe("manifest");
  expect(fieldOf(observation, "Origin")).toBe("network");
  expect(fieldOf(observation, "Freshness")).toBe("fresh");
  expect(fieldOf(observation, "Received")).toBe(
    formatDateTime(1_700_000_000_000),
  );
  expect(fieldOf(observation, "Expires")).toBe(
    formatDateTime(1_700_000_600_000),
  );
  expect(fieldOf(observation, "Issuer")).toBe("release-service");
  expect(fieldOf(observation, "Revision")).toBe("opaque rev-1");

  expect(fieldOf(sectionOf(view, "Offer"), "Identity")).toBe(
    "web-build-a (com.example.notes, web-artifact)",
  );
  expect(fieldOf(sectionOf(view, "Offer"), "Label")).toBe("Build web-build-a");
  expect(fieldOf(sectionOf(view, "Last check"), "State")).toBe("succeeded");
  expect(fieldOf(sectionOf(view, "Last check"), "Attempt")).toBe("1");
  expect(sectionOf(view, "Capabilities").textContent).toContain("reload");
  expect(sectionOf(view, "Capabilities").textContent).toContain(
    "needs offer · binding unpinned-navigation · impacts document-replacement, javascript-restart",
  );
  expect(fieldOf(sectionOf(view, "Prepared"), "Status")).toBeNull();
  expect(sectionOf(view, "Prepared").textContent).toContain("Not applicable");

  // Evidence goes stale by time alone.
  lab.clock.advance(700_000);
  await settle();
  expect(fieldOf(sectionOf(view, "Observation"), "Freshness")).toBe("expired");
  devtools.unmount();
});

test("a route that has nothing on offer says why, and the selection follows the sidebar", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  lab.answer(
    buildDocument({
      binary: {
        kind: "candidate",
        release: {
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "android-version-code",
            value: "90",
          },
          label: "Build 90",
          order: 90,
        },
      },
    }),
  );
  lab.beacon.start();
  await lab.beacon.check();
  await settle();

  fireEvent.click(rowOf(view, "binary"));

  const observation = sectionOf(view, "Observation");

  expect(fieldOf(observation, "Status")).toBe("none");
  expect(fieldOf(observation, "Reason")).toBe("older-than-current");
  expect(fieldOf(observation, "Candidate")).toBe(
    "Build 90, 90 (com.example.notes, android-version-code)",
  );
  expect(within(sectionOf(view, "Offer")).getByText("No offer.")).toBeTruthy();
  expect(rowOf(view, "binary").getAttribute("aria-pressed")).toBe("true");
  expect(rowOf(view, "web").getAttribute("aria-pressed")).toBe("false");

  fireEvent.click(view().getByRole("button", { name: "Deselect route" }));
  expect(view().queryByRole("region", { name: "Selected route" })).toBeNull();
  expect(view().getByRole("region", { name: "Overview" })).toBeTruthy();
  devtools.unmount();
});

test("a route the Beacon no longer has falls back to the overview", async () => {
  const first = createLabBeacon();
  const second = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: first.beacon,
    initialIsOpen: true,
  });

  fireEvent.click(rowOf(view, "ota"));
  expect(detail(view)).toBeTruthy();

  devtools.setBeacon(withRoutes(second.beacon, ["web"]));
  await settle();

  expect(view().queryByRole("region", { name: "Selected route" })).toBeNull();
  expect(view().getByRole("region", { name: "Overview" })).toBeTruthy();
  expect(
    Array.from(sidebar(view).querySelectorAll(".row")).map((row) =>
      row.textContent?.slice(0, 3),
    ),
  ).toEqual(["Ove", "web"]);
  devtools.unmount();
});

test("a route list without routes says so", () => {
  const { beacon } = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: withRoutes(beacon, []),
    initialIsOpen: true,
  });

  expect(view().getByText("no routes defined")).toBeTruthy();
  devtools.unmount();
});
