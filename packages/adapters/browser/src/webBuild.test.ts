import { Beacon, compareIdentities, targetRoute } from "@priemskiyyy/beacon";
import type { NoneDecision, TargetDecision } from "@priemskiyyy/beacon";
import {
  createMockJournalStorage,
  createMockSource,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { browserReload } from "src/browserReload";
import { APPLICATION, fakeWindow, SCOPE } from "src/fakeWindow.fixture";
import { webBuild } from "src/webBuild";

test("an id the bundler injected is the running build, under the application's authority and the word the standard manifest uses", async () => {
  expect(
    await webBuild({ authority: APPLICATION, id: "a91b44e" })({ scope: SCOPE }),
  ).toEqual({
    identity: {
      status: "known",
      authority: APPLICATION,
      domain: "web-artifact",
      value: "a91b44e",
    },
    label: "a91b44e",
    raw: {},
  });
});

test("the label is the application's to name, and the domain too", async () => {
  const release = await webBuild({
    authority: APPLICATION,
    id: "a91b44e",
    label: "September release",
    domain: "notes-web",
  })({ scope: SCOPE });

  expect(release).toMatchObject({
    identity: { domain: "notes-web", value: "a91b44e" },
    label: "September release",
  });
});

test("an id is text with no space around it, so a padded build is the same build", async () => {
  const release = await webBuild({
    authority: APPLICATION,
    id: " a91b44e\n",
  })({ scope: SCOPE });

  expect(release.identity).toMatchObject({ status: "known", value: "a91b44e" });
});

// Vite 8.3 writes `void 0` for an `import.meta.env` name nobody defined and an empty string for an empty define, and a constant written into text gives the text of what it was.
test("an id nobody defined is unknown, never a build named undefined", async () => {
  for (const id of [undefined, null, "", "   ", "undefined", "null"]) {
    const release = await webBuild({ authority: APPLICATION, id })({
      scope: SCOPE,
    });

    expect(release).toEqual({
      identity: { status: "unknown", reason: "build-id-not-injected" },
      label: null,
      raw: {},
    });
  }
});

test("a label nobody defined either is no label, and a real id stands for itself", async () => {
  for (const label of [undefined, null, "", "undefined"]) {
    expect(
      await webBuild({ authority: APPLICATION, id: "a91b44e", label })({
        scope: SCOPE,
      }),
    ).toMatchObject({ label: "a91b44e" });
  }
});

test("the label survives an id nobody defined, since it says what the page reports", async () => {
  const release = await webBuild({
    authority: APPLICATION,
    id: undefined,
    label: "Local build",
  })({ scope: SCOPE });

  expect(release).toMatchObject({
    identity: { status: "unknown" },
    label: "Local build",
  });
});

test("an authority or a domain that is empty or has a space around it is refused when the reader is made", () => {
  for (const options of [
    { authority: "" },
    { authority: " com.example.notes" },
    { authority: APPLICATION, domain: "" },
    { authority: APPLICATION, domain: "web-artifact " },
  ]) {
    expect(() => webBuild({ id: "a91b44e", ...options })).toThrowError(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
    );
  }
});

const createBoot = (
  id: string | undefined,
  storage: ReturnType<typeof createMockJournalStorage>,
  boot: string,
) => {
  const mock = createMockSource<{ web: TargetDecision | NoneDecision }>({
    name: "manifest",
  });

  mock.answer({
    document: {
      web: {
        kind: "target",
        release: {
          identity: {
            status: "known",
            authority: APPLICATION,
            domain: "web-artifact",
            value: "build-b",
          },
          label: "Build b",
        },
      },
    },
    expiresAt: 601_000,
  });

  const target = fakeWindow();

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: boot },
      web: webBuild({ authority: SCOPE.application, id }),
    },
    routes: {
      web: targetRoute({
        source: mock.source.select((manifest) => manifest.web),
        mechanism: browserReload({ target }),
      }),
    },
    journal: { mode: "required", storage },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, target };
};

const reloadIntoNextBoot = async (next: string | undefined) => {
  const storage = createMockJournalStorage();
  const first = createBoot("build-a", storage, "boot-1");

  first.beacon.start();
  await first.beacon.check();

  const { observation } = first.beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  await first.beacon.route("web").reload({ offer: observation.offer.ref });

  const second = createBoot(next, storage, "boot-2");

  second.beacon.start();
  await settle();

  return second.beacon;
};

test("the build a manifest names is named the same way when it runs, so the journal says the reload reached it", async () => {
  const beacon = await reloadIntoNextBoot("build-b");

  expect(beacon.transitions.get().latest).toMatchObject({
    outcome: "target-running",
  });
  expect(beacon.running.get().web).toMatchObject({
    state: "known",
    release: { identity: { value: "build-b" }, label: "build-b" },
  });
});

test("a build that ran before is not the target", async () => {
  const beacon = await reloadIntoNextBoot("build-a");

  expect(beacon.transitions.get().latest).toMatchObject({
    outcome: "target-not-running",
  });
});

test("a boot whose id nobody injected leaves the journal unable to say, never a match on the text undefined", async () => {
  const beacon = await reloadIntoNextBoot(undefined);

  expect(beacon.transitions.get().latest).toMatchObject({
    outcome: "inconclusive",
  });

  await beacon.check();

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "inconclusive",
  });
});

test("a build nobody named equals nothing, not even another build nobody named", async () => {
  const unknown = await webBuild({ authority: APPLICATION, id: undefined })({
    scope: SCOPE,
  });

  expect(compareIdentities(unknown.identity, unknown.identity)).toBe(
    "incomparable",
  );
});
