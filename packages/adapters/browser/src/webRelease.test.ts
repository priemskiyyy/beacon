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
import { webRelease } from "src/webRelease";

test("a web release names the build the way the running reader does, in the application's authority and the web artifact word", () => {
  expect(webRelease({ authority: APPLICATION, id: "a91b44e" })).toEqual({
    identity: {
      status: "known",
      authority: APPLICATION,
      domain: "web-artifact",
      value: "a91b44e",
    },
  });
});

test("it is the identity webBuild reads back, whatever padding or label the id came with", async () => {
  for (const id of ["a91b44e", " a91b44e\n", "b7"]) {
    const release = webRelease({ authority: APPLICATION, id, label: "Sept" });

    const running = await webBuild({ authority: APPLICATION, id })({
      scope: SCOPE,
    });

    expect(compareIdentities(release.identity, running.identity)).toBe("same");
  }
});

test("the label is for people, and is only there when it was given", () => {
  expect(
    webRelease({ authority: APPLICATION, id: "a91b44e", label: "September" }),
  ).toMatchObject({ label: "September" });

  for (const label of [undefined, null, "", "  ", "undefined"]) {
    expect(
      webRelease({ authority: APPLICATION, id: "a91b44e", label }),
    ).not.toHaveProperty("label");
  }
});

// A release is an authority's claim, so unlike a running build it cannot be unknown: an id nobody defined is a mistake the app sees when it makes one.
test("an id that is empty, a blank or the text a missing define compiles to is refused, never a release named undefined", () => {
  for (const id of ["", "   ", "undefined", "null"]) {
    expect(() => webRelease({ authority: APPLICATION, id })).toThrowError(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
    );
  }
});

test("an authority that is empty or has a space around it is refused", () => {
  for (const authority of ["", " com.example.notes"]) {
    expect(() => webRelease({ authority, id: "a91b44e" })).toThrowError(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
    );
  }
});

// Through a Beacon: a custom source that names its build with webRelease is compared with the running one.
const createBeacon = (running: string, deployed: string) => {
  const mock = createMockSource<{ build: string }>({ name: "version-file" });

  mock.answer({ document: { build: deployed }, expiresAt: 601_000 });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: webBuild({ authority: APPLICATION, id: running }),
    },
    routes: {
      web: targetRoute({
        source: mock.source.select((file) => ({
          kind: "target",
          release: webRelease({ authority: APPLICATION, id: file.build }),
        })),
        mechanism: browserReload({ target: fakeWindow() }),
      }),
    },
    journal: { mode: "best-effort", storage: createMockJournalStorage() },
    clock: createTestClock({ now: 1_000 }),
  });

  return beacon;
};

const checked = async (running: string, deployed: string) => {
  const beacon = createBeacon(running, deployed);

  beacon.start();
  await beacon.check();
  await settle();

  return beacon.route("web").state.get().observation;
};

test("a deployed build that is the running one is no offer, and another is an offer of that build", async () => {
  await expect(checked("a91b44e", "a91b44e")).resolves.toMatchObject({
    status: "none",
  });

  await expect(checked("a91b44e", "b7c02d1")).resolves.toMatchObject({
    status: "available",
    offer: { release: { identity: { value: "b7c02d1" } } },
  });
});

test("the return type is a release of a target decision as it stands", () => {
  const decision: TargetDecision | NoneDecision = {
    kind: "target",
    release: webRelease({ authority: APPLICATION, id: "a91b44e" }),
  };

  expect(decision.kind).toBe("target");
});
