import { Beacon, minimumBuild } from "@priemskiyyy/beacon";
import {
  createMockSource,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import { checkOn, foreground } from "@priemskiyyy/beacon/triggers";
import type { AppStateLike } from "@priemskiyyy/beacon/triggers";
import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { appStore } from "src/appStore";
import {
  APP_ID,
  BUNDLE_ID,
  fakeLinking,
  fakeStore,
  SCOPE,
} from "src/fakeStore.fixture";

// The stories play the specification's end-to-end cases with the public API of the core and this package: a store lookup, a link opener and the foreground of the app, each a fake the test drives.

const createAppState = () => {
  const listeners = new Set<(state: string) => void>();

  const appState: AppStateLike = {
    currentState: "active",
    addEventListener: (_type, listener) => {
      listeners.add(listener);

      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
  };

  return {
    appState,
    emit: (state: string) => {
      appState.currentState = state;

      for (const listener of [...listeners]) {
        listener(state);
      }
    },
  };
};

// One boot of an iOS app on build 412 (marketing version 3.2.0) under a minimum build of 500.
const boot = (id: string) => {
  const store = fakeStore();
  const link = fakeLinking();

  const minimum = createMockSource<{ minimumBuild: number }>({
    name: "minimum",
  });

  minimum.answer({ document: { minimumBuild: 500 } });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id },
      native: () => ({
        identity: {
          status: "known",
          authority: BUNDLE_ID,
          domain: "ios-build",
          value: "412",
        },
        label: "3.2.0",
        raw: { shortVersion: "3.2.0", buildNumber: "412" },
      }),
    },
    routes: {
      binary: appStore({
        appId: APP_ID,
        country: "de",
        bundleId: BUNDLE_ID,
        linking: link.linking,
        fetch: store.fetch,
      }),
    },
    policy: minimumBuild({
      source: minimum.source.select((document) => document.minimumBuild),
      remediation: "binary",
    }),
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, store, link };
};

test("Story I the store opens and nothing is installed: the handoff is evidence of a request, the return checks, and the requirement stays unmet", async () => {
  const first = boot("boot-1");
  const app = createAppState();
  const events: BeaconDiagnosticEvent[] = [];

  first.beacon.diagnostics.events.subscribe((event) => events.push(event));
  checkOn(first.beacon, {
    startup: false,
    triggers: [foreground({ appState: app.appState })],
    minInterval: 1,
  });
  first.beacon.start();
  await first.beacon.check({ reason: "startup" });

  const binary = first.beacon.route("binary");

  expect(first.beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: {
      reasons: [{ code: "native-build-too-old" }],
      remediation: [{ route: "binary", level: "required", usable: true }],
    },
  });

  const { observation } = binary.state.get();

  if (observation.status !== "available") {
    throw new Error("The binary route has no offer.");
  }

  // The user taps the button, and the OS accepts the request.
  await expect(
    binary.openStore({ offer: observation.offer }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "store-handoff-requested" },
  });
  expect(first.link.opened).toEqual([`https://apps.apple.com/app/id${APP_ID}`]);
  expect(first.beacon.support.get()).toMatchObject({ status: "unsupported" });

  // The app goes to the background, the user comes back without installing, and the return checks the store and the minimum again.
  const readsBefore = first.store.reads();

  app.emit("background");
  app.emit("active");
  await settle();

  expect(first.store.reads()).toBeGreaterThan(readsBefore);
  expect(first.beacon.support.get()).toMatchObject({ status: "unsupported" });
  expect(first.beacon.running.get().native).toMatchObject({
    release: { identity: { value: "412" } },
  });

  // The accepted handoff is recorded as a settled command and nothing like an installation, in any event.
  expect(events.filter(({ type }) => type === "command-settled")).toMatchObject(
    [{ route: "binary", command: "openStore", reason: "accepted" }],
  );
  expect(
    events.map(({ type, reason }) => `${type} ${reason ?? ""}`).join("\n"),
  ).not.toMatch(/install/i);

  // A later boot of the same binary is the same build: the policy is as unmet as before, and no earlier handoff is replayed or claimed.
  const second = boot("boot-2");

  second.beacon.start();
  await second.beacon.check();
  expect(second.beacon.support.get()).toMatchObject({ status: "unsupported" });
  expect(second.beacon.transitions.get()).toMatchObject({
    journal: "off",
    latest: null,
  });
  expect(second.link.opened).toEqual([]);
});
