import type {
  Evidence,
  ReleaseIdentity,
  TransitionState,
} from "@priemskiyyy/beacon";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";
import { afterEach, expect, test } from "vitest";

import { SupportSection } from "src/components/Overview/SupportSection";
import { TransitionsSection } from "src/components/Overview/TransitionsSection";
import { CapabilitySection } from "src/components/Routes/CapabilitySection";
import { CheckSection } from "src/components/Routes/CheckSection";
import { ObservationSection } from "src/components/Routes/ObservationSection";
import { OfferSection } from "src/components/Routes/OfferSection";
import { OperationSection } from "src/components/Routes/OperationSection";
import { PreparedSection } from "src/components/Routes/PreparedSection";
import { formatDateTime } from "src/formatting/formatDateTime";

afterEach(() => {
  document.body.replaceChildren();
});

const show = (view: () => JSX.Element) => {
  const container = document.body.appendChild(document.createElement("div"));

  render(view, container);

  return container;
};

// The text as it reads: the text nodes of one element run on, and each element inside stands apart.
const words = (node: Node): string =>
  Array.from(node.childNodes, (child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return child.textContent ?? "";
    }

    return ` ${words(child)} `;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

const evidence: Evidence = {
  source: "manifest",
  origin: "network",
  receivedAt: 1_700_000_000_000,
  expiresAt: null,
  freshness: "expired",
  issuer: null,
  revision: { kind: "ordered", domain: "notes-web", epoch: "v1", value: "208" },
};

const identity: ReleaseIdentity = {
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value: "web-build-a",
};

test("an observation that is unknown says why, and nothing is called up to date", () => {
  const container = show(() => (
    <ObservationSection
      observation={{ status: "unknown", reason: "unsupported-environment" }}
    />
  ));

  expect(words(container)).toBe(
    "Observation Status unknown Reason unsupported-environment",
  );
});

test("an observation with nothing on offer shows the authority's reason, its own detail and the candidate, with evidence", () => {
  const container = show(() => (
    <ObservationSection
      observation={{
        status: "none",
        evidence,
        reason: "no-decision",
        detail: "paused-by-operator",
        candidate: { identity, label: "Build a" },
      }}
    />
  ));

  const text = words(container);

  expect(text).toContain("Status none");
  expect(text).toContain("Reason no-decision");
  expect(text).toContain("Detail paused-by-operator");
  expect(text).toContain(
    "Candidate Build a, web-build-a (com.example.notes, web-artifact)",
  );
  expect(text).toContain("Freshness expired");
  expect(text).toContain("Expires never");
  expect(text).toContain("Issuer none");
  expect(text).toContain("Revision notes-web/v1 #208");
  expect(container.querySelector('[data-freshness="expired"]')).not.toBeNull();
});

test("an observation that is inconclusive shows why, and a candidate it may not have", () => {
  const container = show(() => (
    <ObservationSection
      observation={{
        status: "inconclusive",
        evidence,
        reason: "missing-current-identity",
        candidate: null,
      }}
    />
  ));

  expect(words(container)).toContain("Status inconclusive");
  expect(words(container)).toContain("Reason missing-current-identity");
  expect(words(container)).toContain("Candidate none");
});

test("an offer shows its identity and its label, or that there is none", () => {
  const none = show(() => (
    <OfferSection observation={{ status: "unknown", reason: "not-checked" }} />
  ));

  expect(words(none)).toBe("Offer No offer.");

  const offered = show(() => (
    <OfferSection
      observation={{
        status: "available",
        evidence,
        offer: {
          ref: { kind: "offer", route: "web", id: 1 },
          release: { identity },
        },
      }}
    />
  ));

  expect(words(offered)).toBe(
    "Offer Identity web-build-a (com.example.notes, web-artifact) Label none",
  );
});

test("the prepared state says each of its four states, and a provider that cannot prepare is not told it has nothing", () => {
  const states = [
    [
      { status: "not-applicable" },
      "Prepared Not applicable: this route prepares nothing.",
    ],
    [{ status: "unknown" }, "Prepared Status unknown"],
    [
      { status: "none", observedAt: 1_700_000_000_000 },
      `Prepared Status none Observed ${formatDateTime(1_700_000_000_000)}`,
    ],
    [
      {
        status: "ready",
        observedAt: 1_700_000_000_000,
        value: {
          ref: { kind: "prepared", route: "ota", id: 2 },
          release: { identity, label: "Update" },
        },
      },
      `Prepared Status ready Identity web-build-a (com.example.notes, web-artifact) Label Update Observed ${formatDateTime(1_700_000_000_000)}`,
    ],
  ] satisfies Array<
    [Parameters<typeof PreparedSection>[0]["prepared"], string]
  >;

  for (const [prepared, expected] of states) {
    expect(words(show(() => <PreparedSection prepared={prepared} />))).toBe(
      expected,
    );
  }
});

test("the last check says each of its four states, with the error code and message of a failure", () => {
  const at = { startedAt: 1_700_000_000_000, settledAt: 1_700_000_001_000 };
  const started = formatDateTime(at.startedAt);
  const settled = formatDateTime(at.settledAt);

  const states = [
    [{ state: "idle" }, "Last check State idle"],
    [
      { state: "checking", attempt: 2, startedAt: at.startedAt },
      `Last check State checking Attempt 2 Started ${started}`,
    ],
    [
      { state: "succeeded", attempt: 3, ...at },
      `Last check State succeeded Attempt 3 Started ${started} Settled ${settled}`,
    ],
    [
      {
        state: "failed",
        attempt: 4,
        ...at,
        error: { code: "SOURCE_TIMEOUT", message: "The source took too long." },
      },
      `Last check State failed Attempt 4 Started ${started} Settled ${settled} Error SOURCE_TIMEOUT Message The source took too long.`,
    ],
  ] satisfies Array<[Parameters<typeof CheckSection>[0]["check"], string]>;

  for (const [check, expected] of states) {
    expect(words(show(() => <CheckSection check={check} />))).toBe(expected);
  }
});

test("an operation shows its command, its number and its progress as a percentage, or that none is reported", () => {
  const idle = show(() => <OperationSection operation={{ state: "idle" }} />);

  expect(words(idle)).toBe("Operation State idle");

  const running = show(() => (
    <OperationSection
      operation={{
        state: "running",
        operation: { id: 5 },
        command: "download",
        progress: 0.456,
      }}
    />
  ));

  expect(words(running)).toBe(
    "Operation State running Command download Operation 5 Progress 46%",
  );

  const unknown = show(() => (
    <OperationSection
      operation={{
        state: "running",
        operation: { id: 5 },
        command: "download",
        progress: null,
      }}
    />
  ));

  expect(words(unknown)).toContain("Progress not reported");

  const lost = show(() => (
    <OperationSection
      operation={{
        state: "indeterminate",
        operation: { id: 6 },
        command: "reload",
        reason: "outcome-lost",
      }}
    />
  ));

  expect(words(lost)).toBe(
    "Operation State indeterminate Command reload Operation 6 Reason outcome-lost",
  );
});

test("capabilities list each command with what it needs and can do, and say when there are none", () => {
  expect(words(show(() => <CapabilitySection capabilities={{}} />))).toBe(
    "Capabilities No commands declared.",
  );

  const listed = show(() => (
    <CapabilitySection
      capabilities={{
        download: {
          reference: "offer",
          impacts: [],
          binding: "provider-current",
        },
        reload: {
          reference: "prepared",
          impacts: ["document-replacement"],
          binding: "exact-instance",
        },
      }}
    />
  ));

  expect(words(listed)).toBe(
    "Capabilities download needs offer · binding provider-current · impacts none reload needs prepared · binding exact-instance · impacts document-replacement",
  );
});

test("a lapsed policy whose evaluation also failed shows its error beside the reason, and the last evaluation still in view", () => {
  const container = show(() => (
    <SupportSection
      support={{
        revision: 4,
        status: "unknown",
        reason: "expired",
        error: { code: "POLICY_FAILED", message: "The policy threw." },
        evaluation: {
          status: "deprecated",
          reasons: [{ code: "old-web", subject: null }],
          remediation: [
            { route: "web", level: "recommended", usable: false },
            { route: "binary", level: "alternative", usable: true },
          ],
          evaluatedRunningRevision: 3,
          evidence,
        },
      }}
    />
  ));

  const text = words(container);

  expect(text).toContain("unknown snapshot 4");
  expect(text).toContain("Reason expired");
  expect(text).toContain("Error POLICY_FAILED: The policy threw.");
  expect(text).toContain("Evaluated status deprecated");
  expect(text).toContain("Under running revision 3");
  expect(text).toContain("old-web no subject");
  expect(text).toContain("web recommended · not usable now");
  expect(text).toContain("binary alternative · usable now");
  expect(text).toContain("Freshness expired");
});

test("an evaluation with no reasons and no remediation says none of each", () => {
  const container = show(() => (
    <SupportSection
      support={{
        revision: 4,
        status: "supported",
        reason: null,
        error: null,
        evaluation: {
          status: "supported",
          reasons: [],
          remediation: [],
          evaluatedRunningRevision: 1,
          evidence,
        },
      }}
    />
  ));

  expect(words(container)).toContain("Reasons none Remediation none");
});

const transitions = (patch: Partial<TransitionState>): TransitionState => ({
  revision: 2,
  journal: "ready",
  latest: null,
  dropped: 0,
  checkpoints: [],
  ...patch,
});

test("transitions show a spent budget, the intents the journal let go of, and an intent with no known identity", () => {
  const container = show(() => (
    <TransitionsSection
      transitions={transitions({
        journal: "degraded",
        dropped: 3,
        checkpoints: ["primary-screen", "data-loaded"],
        latest: {
          outcome: "target-not-running",
          attempts: 3,
          exhausted: true,
          intent: {
            operation: { id: 8 },
            boot: { id: "boot-1" },
            route: "ota",
            command: "reloadPrepared",
            subject: "bundle",
            current: null,
            target: null,
            binding: "provider-current",
            createdAt: 1_700_000_000_000,
            expiresAt: 1_700_086_400_000,
          },
        },
      })}
    />
  ));

  const text = words(container);

  expect(text).toContain("journal degraded");
  expect(text).toContain("Dropped intents 3");
  expect(text).toContain("Checkpoints primary-screen data-loaded");
  expect(text).toContain("reloadPrepared on ota (bundle, operation 8)");
  expect(text).toContain("Outcome target-not-running");
  expect(text).toContain("Attempts 3, budget spent");
  expect(text).toContain("Was running not known");
  expect(text).toContain("Aimed at no target");
  expect(text).toContain(`Kept until ${formatDateTime(1_700_086_400_000)}`);
});
