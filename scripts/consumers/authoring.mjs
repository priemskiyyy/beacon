// An adapter author's project: a mechanism written with `createUpdateMechanism`, and
// the conformance suites of `@priemskiyyy/beacon/testing` run over it by a real
// Vitest, from the packed core alone.
export const AUTHORING_PACKAGES = ["@priemskiyyy/beacon"];

export const authoringFiles = {
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": [],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
`,

  "src/relaunch.ts": `import { createUpdateMechanism } from "@priemskiyyy/beacon/adapter";
import type { ProviderResult } from "@priemskiyyy/beacon/adapter";

export type Launcher = { relaunch(): void };

export type RelaunchReceipt = { kind: "relaunch-requested" };

export const relaunch = (getLauncher: () => Launcher | null) =>
  createUpdateMechanism({
    name: "relaunch",
    subject: "bundle",
    open: () => ({ native: { launcher: getLauncher() } }),
    commands: {
      relaunch: {
        reference: "offer",
        impacts: ["javascript-restart"],
        binding: "provider-current",
        run: async ({ native }): Promise<ProviderResult<RelaunchReceipt>> => {
          if (native.launcher === null) {
            return { status: "unsupported", reason: "no-launcher" };
          }

          native.launcher.relaunch();

          return {
            status: "accepted",
            receipt: { kind: "relaunch-requested" },
          };
        },
      },
    },
  });
`,

  "src/conformance.test.ts": `import { testUpdateMechanism, testVersionStrategy } from "@priemskiyyy/beacon/testing";
import { semver } from "@priemskiyyy/beacon/versions";

import { relaunch } from "./relaunch";

testUpdateMechanism({
  name: "relaunch",
  create: () => ({ mechanism: relaunch(() => ({ relaunch: () => {} })) }),
});

testVersionStrategy({
  name: "semver",
  create: () => semver(),
  ascending: ["1.0.0", "1.2.0", "2.0.0"],
  invalid: ["latest"],
});
`,

  "src/mock.test.ts": `import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { relaunch } from "./relaunch";

type Deployment = {
  bundle: {
    kind: "target";
    release: {
      identity: { status: "known"; authority: string; domain: string; value: string };
      label: string;
    };
  };
};

const identity = (value: string) => ({
  status: "known" as const,
  authority: "com.example.notes",
  domain: "bundle-id",
  value,
});

test("a mechanism of its own is offered an update and relaunches only when asked", async () => {
  const mock = createMockSource<Deployment>({ name: "manifest" });
  const relaunches = { count: 0 };

  const beacon = new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "android",
      distribution: "google-play",
    },
    running: {
      bundle: () => ({ identity: identity("bundle-1"), label: null, raw: {} }),
    },
    routes: {
      bundle: targetRoute({
        source: mock.source.select((document) => document.bundle),
        mechanism: relaunch(() => ({
          relaunch: () => {
            relaunches.count += 1;
          },
        })),
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  mock.answer({
    document: {
      bundle: {
        kind: "target",
        release: { identity: identity("bundle-2"), label: "Bundle 2" },
      },
    },
  });
  beacon.start();
  await beacon.check({ reason: "manual" });

  const { observation } = beacon.route("bundle").state.get();

  expect(observation.status).toBe("available");
  expect(relaunches.count).toBe(0);

  if (observation.status !== "available") {
    return;
  }

  const outcome = await beacon.route("bundle").relaunch({ offer: observation.offer });

  expect(outcome).toMatchObject({
    status: "accepted",
    receipt: { kind: "relaunch-requested" },
  });
  expect(relaunches.count).toBe(1);
  beacon.dispose();
});
`,
};
