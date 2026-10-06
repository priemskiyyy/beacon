import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock, settle } from "@priemskiyyy/beacon/mock";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import {
  availableInfo,
  downloading,
  fakeBridge,
  installEvent,
} from "src/fakeBridge.fixture";
import { googlePlay } from "src/googlePlay";

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "android",
  distribution: "play-store",
};

const create = (info = availableInfo(412)) => {
  const fake = fakeBridge(info);

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes: { binary: googlePlay({ bridge: fake.bridge }) },
    clock: createTestClock({ now: 1_000 }),
  });

  return { ...fake, beacon, binary: beacon.route("binary") };
};

const checkOffer = async (context: ReturnType<typeof create>) => {
  context.beacon.start();
  await context.binary.check();

  const { observation } = context.binary.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  return observation.offer;
};

test("creating the route and the beacon ask Play for nothing", () => {
  const { calls, listeners } = create();

  expect(calls.queries).toBe(0);
  expect(listeners()).toBe(0);
});

test("the install listener is in place before any flow can start", async () => {
  const context = create();

  context.beacon.start();
  await settle();

  expect(context.listeners()).toBe(1);
});

test("a check is a fresh query, and starts no flow", async () => {
  const context = create();
  const offer = await checkOffer(context);

  expect(offer).toMatchObject({
    flows: ["flexible", "immediate"],
    release: { identity: { value: "412" } },
  });
  expect(context.calls).toMatchObject({ flexible: 0, immediate: 0 });
});

test("PLAY-08 a flexible update is prepared when Play says it downloaded, and progress is Play's own", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const starting = context.binary.download({ offer: offer.ref });

  await settle();

  expect(context.binary.state.get().operation).toMatchObject({
    state: "running",
    command: "download",
  });

  context.install(downloading(1_024, 4_096));
  expect(context.binary.state.get().operation).toMatchObject({
    progress: 0.25,
  });

  context.install(installEvent("downloaded"));

  await expect(starting).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "update-downloaded" },
  });
  expect(context.binary.state.get().prepared).toMatchObject({
    status: "ready",
    value: { release: { identity: { value: "412" } } },
  });
  expect(context.binary.state.get().operation).toEqual({ state: "idle" });
});

test("PLAY-08 a download is not an installation: completing it is a separate command that restarts nothing by itself", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const starting = context.binary.download({ offer: offer.ref });

  await settle();
  context.install(installEvent("downloaded"));
  await starting;

  expect(context.calls.completions).toBe(0);

  const { prepared } = context.binary.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  await expect(
    context.binary.restart({ prepared: prepared.value.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "completion-requested" },
  });
  expect(context.calls.completions).toBe(1);
});

test("PLAY-11 a user who declines the consent dialog cancels the command, and nothing downloads", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setFlow("flexible", "cancelled");

  await expect(context.binary.download({ offer: offer.ref })).resolves.toEqual({
    status: "cancelled",
    stage: "consent",
  });
  expect(context.binary.state.get().prepared).toEqual({ status: "unknown" });
});

test("a download Play reports as failed is a failed command", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const starting = context.binary.download({ offer: offer.ref });

  await settle();
  context.install(installEvent("failed"));

  await expect(starting).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.binary.state.get().operation).toEqual({ state: "idle" });
});

test("a flow Play reports as failed at the consent step is a failed command", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setFlow("flexible", "failed");

  await expect(
    context.binary.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
  });
});

test("an offer Play no longer makes is stale, and no flow starts", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setInfo(availableInfo(413));

  await expect(context.binary.download({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(context.calls.flexible).toBe(0);
});

test("PLAY-01 a flow Play does not allow for this update is unsupported, and no flow starts", async () => {
  const context = create(availableInfo(412, { immediate: false }));
  const offer = await checkOffer(context);

  await expect(context.binary.update({ offer: offer.ref })).resolves.toEqual({
    status: "unsupported",
    reason: "flow-not-allowed",
  });
  expect(context.calls.immediate).toBe(0);
});

test("an immediate flow is disruptive, so a participant is asked, and the route is unresolved once Play took over", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const asked: string[] = [];

  context.beacon.disruptions.register({
    name: "drafts",
    impacts: ["native-update-flow"],
    reserve: () => {
      asked.push("drafts");

      return { status: "reserved", release: () => {} };
    },
  });

  await expect(
    context.binary.update({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "immediate-flow-started" },
  });
  expect(asked).toEqual(["drafts"]);
  expect(context.binary.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "dispatch-unconfirmed",
  });
});

test("PLAY-11 an immediate flow the user declines is cancelled and releases the route", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setFlow("immediate", "cancelled");

  await expect(context.binary.update({ offer: offer.ref })).resolves.toEqual({
    status: "cancelled",
    stage: "consent",
  });
  expect(context.binary.state.get().operation).toEqual({ state: "idle" });
});

test("PLAY-12 a flow Play still holds after a restart is offered as a continuation", async () => {
  const context = create({
    availability: "in-progress",
    installStatus: "downloading",
  });

  const offer = await checkOffer(context);

  expect(offer).toMatchObject({ inProgress: true, flows: ["immediate"] });

  await expect(
    context.binary.update({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
  });
  expect(context.calls.immediate).toBe(1);
});

test("PLAY-13 an update already downloaded when the app starts is prepared without a command", async () => {
  const context = create(availableInfo(412, { installStatus: "downloaded" }));

  context.beacon.start();
  await settle();

  expect(context.binary.state.get().prepared).toMatchObject({
    status: "ready",
    value: { release: { identity: { value: "412" } } },
  });
});

test("PLAY-14 a callback lost after the dispatch leaves the command running, and a restart finds the download", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const controller = new AbortController();

  const starting = context.binary.download({
    offer: offer.ref,
    signal: controller.signal,
  });

  await settle();
  controller.abort();

  await expect(starting).resolves.toMatchObject({ status: "indeterminate" });
  expect(context.binary.state.get().operation.state).toBe("indeterminate");
});

test("ending the session while a download is awaited leaves the outcome unknown", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const starting = context.binary.download({ offer: offer.ref });

  await settle();
  context.beacon.stop();

  await expect(starting).resolves.toMatchObject({
    status: "indeterminate",
    reason: "aborted-after-dispatch",
  });
  expect(context.binary.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "session-ended",
  });
});

test("a query that fails fails the check and keeps what was observed", async () => {
  const context = create();

  await checkOffer(context);
  context.failQueries(new Error("no play services"));

  await expect(context.binary.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
  expect(context.binary.state.get().observation).toMatchObject({
    status: "available",
  });
});

test("stopping the session removes the install listener", async () => {
  const context = create();

  context.beacon.start();
  await settle();
  context.beacon.stop();

  expect(context.listeners()).toBe(0);
});

test("an install event after the session stopped changes nothing", async () => {
  const context = create();

  context.beacon.start();
  await settle();

  const before = context.binary.state.get();

  context.beacon.stop();
  context.install(installEvent("downloaded"));

  expect(context.binary.state.get()).toBe(before);
});

test("the route declares each flow's own impacts, so a participant is asked only about what the flow does", () => {
  const { binary } = create();

  expect(binary.capabilities).toEqual({
    download: {
      reference: "offer",
      impacts: ["may-activate-on-next-start"],
      binding: "provider-current",
    },
    update: {
      reference: "offer",
      impacts: ["native-update-flow", "javascript-restart"],
      binding: "provider-current",
    },
    restart: {
      reference: "prepared",
      impacts: ["javascript-restart"],
      binding: "provider-current",
    },
  });
});

test("PLAY-04 the same start called twice at once is one flow, joined by the second call", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const first = context.binary.download({ offer: offer.ref });
  const second = context.binary.download({ offer: offer.ref });

  await settle();
  context.install(installEvent("downloaded"));

  const outcomes = await Promise.all([first, second]);

  expect(outcomes[0]).toEqual(outcomes[1]);
  expect(context.calls.flexible).toBe(1);
});

test("PLAY-05 a start with no Activity to launch from fails, and is never a successful no-update", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.bridge.startImmediate = async () => {
    throw new Error("no current Activity");
  };

  await expect(
    context.binary.update({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.binary.state.get().operation).toEqual({ state: "idle" });
});

test("PLAY-09 a completion with a prepared reference a later download replaced is refused before the native call", async () => {
  const context = create();
  const first = await checkOffer(context);
  const starting = context.binary.download({ offer: first.ref });

  await settle();
  context.install(installEvent("downloaded"));
  await starting;

  const { prepared: old } = context.binary.state.get();

  context.setInfo(availableInfo(413));
  await context.binary.check();

  const { observation } = context.binary.state.get();

  if (observation.status !== "available" || old.status !== "ready") {
    throw new Error("The route is not where the test expects.");
  }

  const again = context.binary.download({
    offer: observation.offer.ref,
  });

  await settle();
  context.install(installEvent("downloaded"));
  await again;

  await expect(
    context.binary.restart({ prepared: old.value.ref }),
  ).resolves.toEqual({
    status: "stale",
    reason: "replaced",
  });
  expect(context.calls.completions).toBe(0);
});

test("PLAY-15 Play reporting an install without a new boot leaves the running facts and the prepared target as they were", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const starting = context.binary.download({ offer: offer.ref });

  await settle();
  context.install(installEvent("downloaded"));
  await starting;

  const before = context.binary.state.get();
  const running = context.beacon.running.get();

  context.install(installEvent("installing"));
  context.install(installEvent("installed"));

  expect(context.binary.state.get()).toBe(before);
  expect(context.beacon.running.get()).toBe(running);
});

test("SEC-10 a bridge call made outside Beacon is not claimed as an operation, a reservation or a journal entry", async () => {
  const context = create();

  context.beacon.start();
  await settle();
  await context.bridge.startImmediate();

  expect(context.binary.state.get().operation).toEqual({ state: "idle" });
  expect(context.beacon.transitions.get().latest).toBeNull();
});

test("PLAY-03 every start asks Play again first, so the info of an earlier start is never reused", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setFlow("flexible", "cancelled");

  for (const starts of [1, 2]) {
    const queries = context.calls.queries;

    await context.binary.download({ offer: offer.ref });

    expect(context.calls.queries).toBe(queries + 1);
    expect(context.calls.flexible).toBe(starts);
  }
});

test("PLAY-07 a consent the user accepted is a flow under way, not a download, an installation or a boot", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.binary.download({ offer: offer.ref });
  await settle();

  expect(context.calls.flexible).toBe(1);
  expect(context.binary.state.get().operation).toMatchObject({
    state: "running",
    command: "download",
  });
  expect(context.binary.state.get().prepared).toEqual({ status: "unknown" });
  expect(context.beacon.running.get().native).toEqual({
    state: "unconfigured",
  });
});

test("LIFE-11 a second Beacon on the same bridge cannot open the route, and says so", async () => {
  const fake = fakeBridge(availableInfo(412));

  const open = () =>
    new Beacon({
      scope: SCOPE,
      running: { boot: { id: "boot-1" } },
      routes: { binary: googlePlay({ bridge: fake.bridge }) },
      clock: createTestClock({ now: 1_000 }),
    });

  const first = open();
  const second = open();

  const stop = first.start();

  second.start();

  expect(first.route("binary").native.get()).not.toBeNull();
  expect(second.route("binary").native.get()).toBeNull();
  expect(fake.listeners()).toBe(1);

  await expect(second.route("binary").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });

  stop();
  second.stop();
  second.start();

  expect(second.route("binary").native.get()).not.toBeNull();
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

test("SEC-10 a session that ends at any turn after Play answered starts no flow", async () => {
  const commands: Array<"download" | "update"> = ["download", "update"];
  const startedAfterStop: string[] = [];

  for (const command of commands) {
    for (let turns = 0; turns < 8; turns += 1) {
      const context = create();
      const offer = await checkOffer(context);
      const { getUpdateInfo, startFlexible, startImmediate } = context.bridge;

      const noteStart = (name: string) => {
        if (context.beacon.status.get().state !== "stopped") {
          return;
        }

        startedAfterStop.push(`${command} after ${turns} turns: ${name}`);
      };

      context.bridge.getUpdateInfo = async () => {
        afterTurns(turns, () => {
          context.beacon.stop();
        });

        return getUpdateInfo();
      };

      context.bridge.startFlexible = async () => {
        noteStart("flexible");

        return startFlexible();
      };

      context.bridge.startImmediate = async () => {
        noteStart("immediate");

        return startImmediate();
      };

      const pending = context.binary[command]({ offer: offer.ref });

      await settle();
      context.install(installEvent("downloaded"));
      await pending;
    }
  }

  expect(startedAfterStop).toEqual([]);
});

test("SEC-10 a session that ends while Play is asked again starts no flow", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.holdQueries();

  const flexible = context.binary.download({ offer: offer.ref });

  await settle();
  context.beacon.stop();
  context.releaseQueries();
  await flexible;

  expect(context.calls.flexible).toBe(0);

  context.beacon.start();
  await context.binary.check();

  const { observation } = context.binary.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  context.holdQueries();

  const immediate = context.binary.update({
    offer: observation.offer.ref,
  });

  await settle();
  context.beacon.stop();
  context.releaseQueries();
  await immediate;

  expect(context.calls.immediate).toBe(0);
});

test("PLAY-11 a download the user or the system cancels is cancelled, not a failure", async () => {
  const context = create();
  const offer = await checkOffer(context);
  const starting = context.binary.download({ offer: offer.ref });

  await settle();
  context.install(installEvent("canceled"));

  await expect(starting).resolves.toMatchObject({ status: "cancelled" });
});

test("PLAY-01 a flow Play no longer allows when it is asked again is unsupported, and no flow starts", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setInfo(availableInfo(412, { flexible: false }));

  await expect(
    context.binary.download({ offer: offer.ref }),
  ).resolves.toMatchObject({ status: "unsupported" });
  expect(context.calls.flexible).toBe(0);
});

test("PLAY-01 a download of an offer that allowed only the immediate flow is unsupported, and no flow starts", async () => {
  const context = create(availableInfo(412, { flexible: false }));
  const offer = await checkOffer(context);

  await expect(context.binary.download({ offer: offer.ref })).resolves.toEqual({
    status: "unsupported",
    reason: "flow-not-allowed",
  });
  expect(context.calls.flexible).toBe(0);
});

test("PLAY-01 an immediate flow Play no longer allows when it is asked again is unsupported, and no flow starts", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setInfo(availableInfo(412, { immediate: false }));

  await expect(context.binary.update({ offer: offer.ref })).resolves.toEqual({
    status: "unsupported",
    reason: "flow-not-allowed",
  });
  expect(context.calls.immediate).toBe(0);
});

test("an immediate flow for an offer Play no longer makes is stale, and no flow starts", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setInfo(availableInfo(413));

  await expect(context.binary.update({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(context.calls.immediate).toBe(0);
});

test("an offer is stale when Play now offers nothing, or cannot say", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setInfo({ availability: "not-available" });
  await expect(context.binary.download({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });

  context.setInfo({ availability: "unknown" });
  await expect(context.binary.download({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(context.calls.flexible).toBe(0);
});

test("PLAY-12 an offer is stale when Play holds a flow now that it did not before, or no longer holds the one it did", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setInfo({
    availability: "in-progress",
    installStatus: "downloading",
  });
  await expect(context.binary.update({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });

  const held = create({
    availability: "in-progress",
    installStatus: "downloading",
  });

  const continuation = await checkOffer(held);

  held.setInfo(availableInfo(412));
  await expect(
    held.binary.update({ offer: continuation.ref }),
  ).resolves.toEqual({ status: "stale", reason: "provider-changed" });
  expect(context.calls.immediate + held.calls.immediate).toBe(0);
});

test("an immediate flow Play reports as failed at the consent step is a failed command", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setFlow("immediate", "failed");

  await expect(
    context.binary.update({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.binary.state.get().operation).toEqual({ state: "idle" });
});

test("PLAY-13 a download Play reports before any version was named is prepared under no version", async () => {
  const context = create({ availability: "not-available" });

  context.beacon.start();
  await settle();
  context.install(installEvent("downloaded"));

  expect(context.binary.state.get().prepared).toMatchObject({
    status: "ready",
    value: {
      release: {
        identity: { status: "unknown", reason: "play-update-downloaded" },
      },
    },
  });
});

test("PLAY-05 a flexible start with no Activity to launch from fails, and a download that follows is not named by it", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.bridge.startFlexible = async () => {
    throw new Error("no current Activity");
  };

  await expect(
    context.binary.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });

  context.install(installEvent("downloaded"));

  expect(context.binary.state.get().prepared).toMatchObject({
    status: "ready",
    value: {
      release: {
        identity: { status: "unknown", reason: "play-update-downloaded" },
      },
    },
  });
});

test("PLAY-13 a download that no flow of Beacon's started is prepared under no version, not under the last one a query named", async () => {
  const context = create();

  await checkOffer(context);
  context.install(installEvent("downloaded"));

  expect(context.binary.state.get().prepared).toMatchObject({
    status: "ready",
    value: {
      release: {
        identity: { status: "unknown", reason: "play-update-downloaded" },
      },
    },
  });
});

test("a session that ends while Play is asked at its start reports nothing", async () => {
  const context = create();

  context.holdQueries();
  context.beacon.start();
  await settle();
  context.beacon.stop();

  const before = context.binary.state.get();

  context.releaseQueries();
  await settle();

  expect(context.binary.state.get()).toBe(before);
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("a check that ends with its session prepares nothing late", async () => {
  const context = create(availableInfo(412, { installStatus: "downloaded" }));

  context.beacon.start();
  await settle();
  context.holdQueries();

  const checking = context.binary.check();

  await settle();
  context.beacon.stop();
  context.releaseQueries();
  await checking;

  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("an install event a bridge still delivers after the session ended changes nothing", async () => {
  const context = create();

  context.beacon.start();
  await settle();

  const before = context.binary.state.get();

  context.ignoreRemoval();
  context.beacon.stop();
  context.install(installEvent("downloaded"));
  context.install(downloading(1_024, 4_096));

  expect(context.binary.state.get()).toBe(before);
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("PLAY-02 a version code the bridge garbles is an environment that cannot say, and prepares nothing", async () => {
  const context = create(
    availableInfo(Number.NaN, { installStatus: "downloaded" }),
  );

  context.beacon.start();
  await context.binary.check();

  expect(context.binary.state.get().observation).toMatchObject({
    status: "unknown",
    reason: "unsupported-environment",
  });
  expect(context.binary.state.get().prepared).toEqual({ status: "unknown" });
});

test("PLAY-02 an offer is stale when Play garbles its version code, and no flow starts", async () => {
  const context = create();
  const offer = await checkOffer(context);

  context.setInfo(availableInfo(-1));

  await expect(context.binary.download({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(context.calls.flexible).toBe(0);
});
