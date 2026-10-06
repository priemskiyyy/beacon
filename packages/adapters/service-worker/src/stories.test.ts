import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock, settle } from "@priemskiyyy/beacon/mock";
import type { DisruptionParticipant, ReleaseScope } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import {
  fakeContainer,
  fakeRegistration,
  fakeWorker,
} from "src/fakeWorkers.fixture";
import type { FakeRegistration } from "src/fakeWorkers.fixture";
import { serviceWorker } from "src/serviceWorker";

// The stories play the specification's end-to-end cases with the public API of the core and this package: one registration and its workers, shared by the tabs of an origin, each tab with a Beacon of its own.

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

// One tab: a document that runs build B, and a Beacon over the shared registration.
const openTab = (registration: FakeRegistration, settlement = 10_000) => {
  const container = fakeContainer(() => registration);
  const clock = createTestClock({ now: 1_000 });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => ({
        identity: {
          status: "known",
          authority: "com.example.notes",
          domain: "web-artifact",
          value: "web-build-b",
        },
        label: "Build web-build-b",
        raw: {},
      }),
    },
    routes: { worker: serviceWorker({ container }) },
    timeouts: { settlement },
    clock,
  });

  beacon.start();

  return { beacon, container, clock, worker: beacon.route("worker") };
};

type Tab = ReturnType<typeof openTab>;

const offerOf = (tab: Tab) => {
  const { observation } = tab.worker.state.get();

  if (observation.status !== "available") {
    throw new Error("The worker route has no offer.");
  }

  return observation.offer;
};

// What the tabs of an application say to each other, as the application writes it: its own channel, which Beacon neither provides nor trusts.
type Peers = { answers: Array<"ready" | "unsaved" | "silent"> };

const createPeerGuard = (peers: Peers): DisruptionParticipant => ({
  name: "peers",
  impacts: ["worker-takeover"],
  reserve: () => ({
    status: "reserved",
    settle: () => {
      if (peers.answers.includes("unsaved")) {
        return Promise.resolve({
          status: "blocked",
          code: "peer-has-unsaved-work",
        });
      }

      // A tab that does not answer is a frozen one, and no answer is no consent.
      if (peers.answers.includes("silent")) {
        return new Promise(() => {});
      }

      return Promise.resolve({ status: "ready" });
    },
  }),
});

test("Story F a waiting worker is left waiting, and takeover is requested only when the application's own peer policy says every tab is ready", async () => {
  const waiting = fakeWorker("installed");

  const registration = fakeRegistration({
    active: fakeWorker("activated"),
    waiting,
  });

  const tabA = openTab(registration, 5_000);
  const tabB = openTab(registration);

  await settle();

  // The waiting worker is a real instance, and both tabs name the very same one.
  expect(offerOf(tabA).worker.id).toBe(offerOf(tabB).worker.id);

  // Conservative by default: nothing activates it, whatever the tabs check.
  await tabA.beacon.check({ reason: "startup" });
  await tabB.beacon.check({ reason: "startup" });
  expect(waiting.messages).toEqual([]);

  // Tab B has an unsaved form, and its own guard keeps its own request from going.
  tabB.beacon.disruptions.register({
    name: "form",
    impacts: ["worker-takeover"],
    reserve: () => ({ status: "blocked", code: "unsaved-form" }),
  });
  await expect(
    tabB.worker.activate({ offer: offerOf(tabB) }),
  ).resolves.toMatchObject({
    status: "blocked",
    reasons: [{ code: "unsaved-form", participant: { name: "form" } }],
  });
  expect(waiting.messages).toEqual([]);

  // Tab A is idle, and nothing in its blocker set can certify tab B: an application that wants every tab asked brings its own policy.
  const peers: Peers = { answers: ["unsaved"] };

  tabA.beacon.disruptions.register(createPeerGuard(peers));

  await expect(
    tabA.worker.activate({ offer: offerOf(tabA) }),
  ).resolves.toMatchObject({
    status: "blocked",
    reasons: [
      { code: "peer-has-unsaved-work", participant: { name: "peers" } },
    ],
  });
  expect(waiting.messages).toEqual([]);

  // A frozen tab never answers, and the timeout is not consent either.
  peers.answers = ["ready", "silent"];

  const asking = tabA.worker.activate({ offer: offerOf(tabA) });

  await settle();
  tabA.clock.advance(5_000);
  await expect(asking).resolves.toMatchObject({
    status: "blocked",
    reasons: [{ code: "settlement-timeout", participant: { name: "peers" } }],
  });
  expect(waiting.messages).toEqual([]);

  // Every tab answered ready, and only then is the request made, as a request whose receipt names the worker it asked.
  peers.answers = ["ready", "ready"];

  await expect(
    tabA.worker.activate({ offer: offerOf(tabA) }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "activation-requested" },
  });
  expect(waiting.messages).toHaveLength(1);

  // The worker is observed activating, which changes the worker and not any document: each tab still runs build B until a real boot.
  registration.activate();
  tabA.container.changeController();
  tabB.container.changeController();

  for (const tab of [tabA, tabB]) {
    expect(tab.worker.state.get().prepared).toMatchObject({ status: "ready" });
    expect(tab.beacon.running.get().web).toMatchObject({
      state: "known",
      release: { identity: { value: "web-build-b" } },
    });
  }
});
