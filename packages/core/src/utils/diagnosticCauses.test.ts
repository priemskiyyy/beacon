import { expect, test } from "vitest";

import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { createMockSource } from "src/mock/createMockSource";
import { settle } from "src/mock/settle";
import type { BeaconDiagnosticEvent } from "src/types/BeaconDiagnosticEvent";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { BeaconDiagnostics } from "src/types/BeaconDiagnostics";
import type { JournalStorage } from "src/types/JournalStorage";
import { BeaconError } from "src/utils/BeaconError";
import { createRoutedBeacon } from "src/utils/Beacon.fixture";
import {
  createWebCommandBeacon,
  startWithOffer,
  takeRun,
} from "src/utils/commands.fixture";
import { createDriverBeacon } from "src/utils/drivers.fixture";
import { buildIntent, buildStored, seed } from "src/utils/journal.fixture";
import { createPolicyBeacon } from "src/utils/policy.fixture";
import { target } from "src/utils/routes.fixture";
import type { Manifest } from "src/utils/routes.fixture";
import type { CommandMap } from "src/types/CommandMap";
import type { ProviderResult } from "src/types/ProviderResult";
import type { RouteBody } from "src/types/RouteBody";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { targetRoute } from "src/utils/targetRoute";

const listen = (diagnostics: BeaconDiagnostics) => {
  const events: BeaconDiagnosticEvent[] = [];

  diagnostics.events.subscribe((event) => events.push(event));

  return {
    events,
    of: (type: BeaconDiagnosticEventType) =>
      events.filter((event) => event.type === type),
  };
};

test("a source that rejects leaves its raw error on the read-failed event, and nowhere in the state", async () => {
  const context = createWebCommandBeacon();
  const heard = listen(context.beacon.diagnostics);
  const failure = new Error("https://user:secret@example.com returned 500");

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  context.mock.reject(failure);
  await checking;

  expect(heard.of("read-failed")).toMatchObject([
    { reason: "SOURCE_FAILED", cause: failure },
  ]);

  const { check } = context.beacon.route("web").state.get();

  expect(JSON.stringify(check)).not.toContain("secret");
  expect(JSON.stringify(context.beacon.diagnostics.get())).not.toContain(
    "secret",
  );
});

test("a BeaconError that a source throws is the cause as it was thrown, and a read that ran out of time has none", async () => {
  const context = createWebCommandBeacon();
  const heard = listen(context.beacon.diagnostics);

  const thrown = new BeaconError({
    code: "SOURCE_FAILED",
    message: "The manifest answered 503.",
  });

  context.beacon.start();

  const first = context.beacon.route("web").check();

  await settle();
  context.mock.reject(thrown);
  await first;

  const second = context.beacon.route("web").check();

  await settle();
  context.clock.advance(10_000);
  await second;

  expect(heard.of("read-failed")).toMatchObject([
    { reason: "SOURCE_FAILED", cause: thrown },
    { reason: "SOURCE_TIMEOUT", cause: null },
  ]);
});

test("an event that is no failure has no cause, and a failure nobody threw has none either", async () => {
  const context = createWebCommandBeacon();
  const heard = listen(context.beacon.diagnostics);

  await startWithOffer(context);

  expect(heard.events.length).toBeGreaterThan(0);

  for (const event of heard.events) {
    expect(event.cause).toBeNull();
  }
});

test("a running reader that throws leaves its raw error on the running-failed event", async () => {
  const failure = new Error("The bundle id could not be read.");

  const { beacon } = createRoutedBeacon(
    {},
    {
      running: {
        boot: { id: "boot-1" },
        web: () => {
          throw failure;
        },
      },
    },
  );

  const heard = listen(beacon.diagnostics);

  beacon.start();
  await settle();

  expect(heard.of("running-failed")).toMatchObject([
    { reason: "web", cause: failure },
  ]);
  expect(beacon.running.get().web).toMatchObject({
    state: "failed",
    error: { code: "RUNNING_READ_FAILED" },
  });
  expect(JSON.stringify(beacon.running.get())).not.toContain(failure.message);
});

test("a select function that throws fails its route with a message that names it, and its raw error is the cause", async () => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const failure = new TypeError("Cannot read properties of undefined");

  const web = targetRoute({
    source: mock.source.select(() => {
      throw failure;
    }),
    mechanism: createUpdateMechanism({
      name: "inert",
      subject: "web",
      open: () => ({ native: {} }),
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => ({
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "web-artifact",
            value: "web-build-a",
          },
          label: null,
          raw: {},
        }),
      },
    },
  );

  const heard = listen(beacon.diagnostics);

  beacon.start();

  const checking = beacon.route("web").check();

  await settle();
  mock.resolve({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
    expiresAt: 601_000,
  });

  await expect(checking).resolves.toMatchObject({
    status: "failed",
    error: {
      code: "SELECTION_FAILED",
      message: "The select function of the route threw, so it chose nothing.",
    },
  });
  expect(heard.of("route-failed")).toMatchObject([
    { route: "web", reason: "SELECTION_FAILED", cause: failure },
  ]);
});

test("a source that fails says where the cause is, in the error the check publishes", async () => {
  const context = createWebCommandBeacon();

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  context.mock.reject(new Error("offline"));

  await expect(checking).resolves.toMatchObject({
    status: "failed",
    error: {
      code: "SOURCE_FAILED",
      message:
        "A release source could not be read. The cause is on the read-failed event of beacon.diagnostics.events.",
    },
  });
});

test("a provider that throws when it opens leaves its raw error on the route-failed event of start", async () => {
  const failure = new Error("The native module is not linked.");
  const context = createDriverBeacon({ failOpen: failure });
  const heard = listen(context.beacon.diagnostics);

  context.beacon.start();

  expect(heard.of("route-failed")).toMatchObject([
    { route: "ota", reason: "DRIVER_FAILED", cause: failure },
  ]);
  await expect(context.ota.check()).resolves.toMatchObject({
    status: "failed",
    error: {
      code: "DRIVER_FAILED",
      message:
        "The provider is not open: it threw while it opened. The cause is on the route-failed event of beacon.diagnostics.events.",
    },
  });
});

test("a provider whose native module another Beacon holds says so when the session starts, and at its first check", async () => {
  const manager = {};
  const first = createDriverBeacon({}, manager);
  const second = createDriverBeacon({}, manager);
  const heard = listen(second.beacon.diagnostics);

  first.beacon.start();
  second.beacon.start();

  const message =
    "The provider is not open: its native module is held by another Beacon session (a second Beacon, or Fast Refresh). Stop the first, or start only through BeaconProvider.";

  expect(heard.of("route-failed")).toMatchObject([
    {
      route: "ota",
      reason: "DRIVER_FAILED",
      cause: { code: "DRIVER_FAILED", message },
    },
  ]);
  await expect(second.ota.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED", message },
  });
});

const refreshing = {
  refresh: {
    reference: "none",
    impacts: [],
    binding: "provider-current",
    run: async (): Promise<ProviderResult<{ kind: "refreshed" }>> => ({
      status: "accepted",
      receipt: { kind: "refreshed" },
    }),
  },
} satisfies CommandMap<object, RouteBody, RouteBody>;

// A command that needs no offer reaches a provider that never opened, so it is told why that provider is closed, as a check is.
const createRefreshBeacon = (manager: object, failure: Error | null) =>
  createRoutedBeacon({
    store: createReleaseDriver<object, RouteBody, RouteBody, typeof refreshing>(
      {
        name: "store",
        subject: "native",
        prepares: false,
        exclusive: manager,
        open: () => {
          if (failure !== null) {
            throw failure;
          }

          return {
            native: {},
            check: async () => ({
              status: "none",
              reason: "no-decision",
              detail: null,
            }),
          };
        },
        commands: refreshing,
      },
    ),
  });

test("a command that finds its provider closed because it threw while it opened says so", async () => {
  const context = createRefreshBeacon({}, new Error("not linked"));

  context.beacon.start();

  await expect(context.beacon.route("store").refresh()).resolves.toMatchObject({
    status: "failed",
    error: {
      code: "DRIVER_FAILED",
      message:
        "The provider is not open: it threw while it opened. The cause is on the route-failed event of beacon.diagnostics.events.",
    },
  });
});

test("a command that finds its provider closed because another Beacon holds its native module says so", async () => {
  const manager = {};
  const first = createRefreshBeacon(manager, null);
  const second = createRefreshBeacon(manager, null);

  first.beacon.start();
  second.beacon.start();

  await expect(second.beacon.route("store").refresh()).resolves.toMatchObject({
    status: "failed",
    error: {
      code: "DRIVER_FAILED",
      message:
        "The provider is not open: its native module is held by another Beacon session (a second Beacon, or Fast Refresh). Stop the first, or start only through BeaconProvider.",
    },
  });
  await expect(first.beacon.route("store").refresh()).resolves.toMatchObject({
    status: "accepted",
  });
});

test("a provider that throws while it is checked says so, and its raw error is the cause of the failed read", async () => {
  const failure = new Error("updates.checkForUpdateAsync rejected");

  const context = createDriverBeacon({ failCheck: failure });

  const heard = listen(context.beacon.diagnostics);

  context.beacon.start();

  await expect(context.ota.check()).resolves.toMatchObject({
    status: "failed",
    error: {
      code: "DRIVER_FAILED",
      message: "The provider threw while it was checked.",
    },
  });
  expect(heard.of("read-failed")).toMatchObject([
    { route: null, reason: "DRIVER_FAILED", cause: failure },
  ]);
});

test("a support policy that throws leaves its raw error on the policy-failed event", async () => {
  const failure = new Error("minimum_build is not a number");

  const context = createPolicyBeacon({
    evaluate: () => {
      throw failure;
    },
  });

  const heard = listen(context.beacon.diagnostics);

  context.beacon.start();

  const checking = context.beacon.check();

  await settle();
  context.mock.resolve({
    document: {
      web: target("web-build-a"),
      binary: { kind: "none", reason: "no-decision" },
      support: { minimumBuild: 108, deprecatedBelow: 100 },
    },
    expiresAt: 601_000,
  });
  await checking;

  expect(heard.of("policy-failed")).toMatchObject([
    { reason: "POLICY_FAILED", cause: failure },
  ]);
  expect(context.beacon.support.get().error).toEqual({
    code: "POLICY_FAILED",
    message: "The support policy could not be evaluated.",
  });
});

test("a journal whose storage fails leaves the raw error of each failure on its journal-failed event", async () => {
  const memory = createMockJournalStorage();
  const readFailure = new Error("The key-value store is locked.");
  const clearFailure = new Error("The key-value store is full.");

  const storage: JournalStorage = {
    ...memory,
    remove: () => Promise.reject(clearFailure),
  };

  memory.failReads(readFailure);

  const context = createWebCommandBeacon({
    journal: { mode: "best-effort", storage },
  });

  const heard = listen(context.beacon.diagnostics);

  context.beacon.start();
  await settle();
  await context.beacon.clearJournal();

  expect(heard.of("journal-failed")).toMatchObject([
    { reason: "read", cause: readFailure },
    { reason: "clear", cause: clearFailure },
  ]);
});

test("a journal that cannot write back what a new boot decided leaves the raw error on its journal-failed event", async () => {
  const storage = createMockJournalStorage();
  const failure = new Error("The key-value store is full.");

  seed(storage, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);
  storage.failWrites(failure);

  const context = createWebCommandBeacon({
    journal: { mode: "best-effort", storage },
  });

  const heard = listen(context.beacon.diagnostics);

  context.beacon.start();
  await settle();

  expect(heard.of("journal-failed")).toMatchObject([
    { reason: "write", cause: failure },
  ]);
  expect(context.beacon.transitions.get().journal).toBe("degraded");
});

test("a required write that fails leaves the storage error on both the journal-failed and the command-settled events, and on neither outcome", async () => {
  const storage = createMockJournalStorage();
  const failure = new Error("The key-value store is full.");

  const context = createWebCommandBeacon({
    journal: { mode: "required", storage },
  });

  const offer = await startWithOffer(context);

  await settle();

  const heard = listen(context.beacon.diagnostics);

  storage.failWrites(failure);

  const outcome = await context.beacon.route("web").reload({ offer });

  expect(outcome).toEqual({
    status: "failed",
    error: {
      code: "JOURNAL_FAILED",
      message: "The transition intent could not be persisted.",
    },
  });
  expect(heard.of("journal-failed")).toMatchObject([
    { reason: "write", cause: failure },
  ]);
  expect(heard.of("command-settled")).toMatchObject([
    { reason: "failed", cause: failure },
  ]);
});

test("a provider command that throws leaves its raw error on the command-settled event, and a refusal has none", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const failure = new Error("window.location.reload is not allowed here");
  const heard = listen(context.beacon.diagnostics);
  const web = context.beacon.route("web");

  const failing = web.reload({ offer });

  await settle();
  takeRun(context.runs).fail(failure);

  await expect(failing).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });

  context.beacon.disruptions.register({
    name: "drafts",
    reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
  });

  await expect(web.reload({ offer })).resolves.toMatchObject({
    status: "blocked",
  });

  expect(heard.of("command-settled").map((event) => event.cause)).toEqual([
    failure,
    null,
  ]);
});
