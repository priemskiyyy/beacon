import { Beacon } from "@priemskiyyy/beacon";
import { fireEvent, within } from "@testing-library/dom";
import { createTestClock, settle } from "@priemskiyyy/beacon/mock";
import { afterEach, expect, test } from "vitest";

import { SCOPE, buildDocument, createLabBeacon } from "src/beacon.fixture";
import { formatDateTime } from "src/formatting/formatDateTime";
import { mountDevtools } from "src/mountDevtools.fixture";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

type View = ReturnType<typeof mountDevtools>["view"];

const section = (view: View, title: string) =>
  within(view().getByRole("region", { name: "Overview" })).getByRole("region", {
    name: title,
  });

const fieldOf = (container: HTMLElement, label: string) => {
  const field = Array.from(container.querySelectorAll(".field")).find(
    (candidate) => candidate.querySelector("dt")?.textContent === label,
  );

  return field?.querySelector("dd")?.textContent ?? null;
};

const factOf = (view: View, subject: string) => {
  const fact = Array.from(
    section(view, "Running").querySelectorAll(".fact"),
  ).find(
    (candidate) =>
      candidate instanceof HTMLElement &&
      candidate.dataset["subject"] === subject,
  );

  if (!(fact instanceof HTMLElement)) {
    throw new Error(`No running fact for ${subject}`);
  }

  return fact;
};

test("the overview shows what runs per subject: unconfigured, pending, then known with its identity, label and read time", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  expect(fieldOf(section(view, "Running"), "Boot")).toBe("boot-1");
  expect(factOf(view, "native").textContent).toContain("pending");
  expect(factOf(view, "web").textContent).toContain(
    "The reader has not answered yet.",
  );
  expect(factOf(view, "bundle").textContent).toContain("unconfigured");
  expect(factOf(view, "worker").textContent).toContain(
    "No reader is configured.",
  );

  lab.beacon.start();
  await settle();

  expect(factOf(view, "native").textContent).toContain("known");
  expect(factOf(view, "native").textContent).toContain(
    "100 (com.example.notes, android-version-code)",
  );
  expect(factOf(view, "native").textContent).toContain("label Build 100");
  expect(factOf(view, "native").textContent).toContain(
    `read ${formatDateTime(1_700_000_000_000)}`,
  );
  expect(factOf(view, "web").textContent).toContain(
    "web-build-b (com.example.notes, web-artifact)",
  );
  expect(factOf(view, "native").textContent).toContain("Raw values hidden.");
  expect(fieldOf(section(view, "Running"), "Revision")).toBe(
    String(lab.beacon.running.get().revision),
  );
  devtools.unmount();
});

test("a running fact that could not be read shows its error code, and never an old version", async () => {
  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-9" },
      web: () => {
        throw new Error("reader broke");
      },
    },
    routes: {},
    clock: createTestClock({ now: 1_000 }),
  });

  const { devtools, view } = mountDevtools({ beacon, initialIsOpen: true });

  beacon.start();
  await settle();

  expect(factOf(view, "web").textContent).toContain("failed");
  expect(factOf(view, "web").textContent).toContain("RUNNING_READ_FAILED");
  expect(view().getByText("no routes defined")).toBeTruthy();
  devtools.unmount();
});

test("support is unknown before a check, then shows the verdict, its reasons, what remediates it and the evidence", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  expect(section(view, "Support").textContent).toContain("unknown");
  expect(fieldOf(section(view, "Support"), "Reason")).toBe("not-checked");
  expect(section(view, "Support").textContent).toContain("No evaluation yet.");

  lab.answer(buildDocument());
  lab.beacon.start();
  await lab.beacon.check();
  await settle();

  const support = section(view, "Support");

  expect(support.querySelector(".status")?.textContent).toBe("unsupported");
  expect(fieldOf(support, "Reason")).toBe("none");
  expect(fieldOf(support, "Error")).toBe("none");
  expect(fieldOf(support, "Evaluated status")).toBe("unsupported");
  expect(fieldOf(support, "Reasons")).toContain("native-build-too-old");
  expect(fieldOf(support, "Reasons")).toContain("native");
  expect(fieldOf(support, "Remediation")).toContain("binary");
  expect(fieldOf(support, "Remediation")).toContain("required");
  expect(fieldOf(support, "Remediation")).toContain("usable now");
  expect(fieldOf(support, "Source")).toBe("manifest");
  expect(fieldOf(support, "Issuer")).toBe("release-service");
  expect(fieldOf(support, "Revision")).toBe("opaque rev-1");
  devtools.unmount();
});

test("a Beacon without a policy says so, and a policy that lapsed keeps its last evaluation beside the reason", async () => {
  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-9" } },
    routes: {},
    clock: createTestClock({ now: 1_000 }),
  });

  const bare = mountDevtools({ beacon, initialIsOpen: true });

  expect(fieldOf(section(bare.view, "Support"), "Reason")).toBe("no-policy");
  bare.devtools.unmount();

  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  lab.answer(buildDocument());
  lab.beacon.start();
  await lab.beacon.check();
  lab.clock.advance(700_000);
  await settle();

  expect(fieldOf(section(view, "Support"), "Reason")).toBe("expired");
  expect(fieldOf(section(view, "Support"), "Evaluated status")).toBe(
    "unsupported",
  );
  expect(fieldOf(section(view, "Support"), "Freshness")).toBe("expired");
  devtools.unmount();
});

test("transitions show the journal, the latest intent with what the running facts say about it, and this boot's checkpoints", async () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  expect(section(view, "Transitions").textContent).toContain("journal reading");

  lab.answer(buildDocument());
  lab.beacon.start();
  await lab.beacon.check();
  await settle();

  expect(section(view, "Transitions").textContent).toContain("journal ready");
  expect(section(view, "Transitions").textContent).toContain(
    "No intent recorded.",
  );
  expect(section(view, "Transitions").textContent).toContain(
    "none reported in this boot",
  );

  const web = lab.beacon.route("web");
  const { observation } = web.state.get();

  if (observation.status !== "available") {
    throw new Error("Expected an offer on the web route.");
  }

  const reload = web.reload({ offer: observation.offer.ref });

  await settle();
  lab.settleReload({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  await reload;
  lab.beacon.reportReady({ checkpoint: "primary-screen" });
  await settle();

  const transitions = section(view, "Transitions");

  expect(fieldOf(transitions, "Latest intent")).toBe(
    "reload on web (web, operation 1)",
  );
  expect(fieldOf(transitions, "Outcome")).toBe("same-boot");
  expect(fieldOf(transitions, "Attempts")).toBe("0, within budget");
  expect(fieldOf(transitions, "Was running")).toBe(
    "web-build-b (com.example.notes, web-artifact)",
  );
  expect(fieldOf(transitions, "Aimed at")).toBe(
    "web-build-a (com.example.notes, web-artifact)",
  );
  expect(fieldOf(transitions, "Binding")).toBe("unpinned-navigation");
  expect(fieldOf(transitions, "Written")).toBe(
    formatDateTime(1_700_000_000_000),
  );
  expect(fieldOf(transitions, "Checkpoints")).toBe("primary-screen");
  expect(fieldOf(transitions, "Dropped intents")).toBe("0");
  devtools.unmount();
});

test("a Beacon without a journal says it is off and no intent was written", async () => {
  const lab = createLabBeacon({ journal: false });

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  lab.beacon.start();
  await settle();

  expect(section(view, "Transitions").textContent).toContain("journal off");
  expect(section(view, "Transitions").textContent).toContain(
    "No intent recorded.",
  );
  devtools.unmount();
});

test("selecting the overview again after a route brings the three sections back", () => {
  const lab = createLabBeacon();

  const { devtools, view } = mountDevtools({
    beacon: lab.beacon,
    initialIsOpen: true,
  });

  fireEvent.click(view().getByRole("button", { name: /^web/ }));
  expect(view().queryByRole("region", { name: "Overview" })).toBeNull();

  fireEvent.click(view().getByRole("button", { name: /^Overview/ }));
  expect(view().getByRole("region", { name: "Overview" })).toBeTruthy();
  devtools.unmount();
});
