import { describe, expect, test, vi } from "vitest";

import { listFailed, runCollected } from "src/testing/collectChecks.fixture";
import { testRunningReader } from "src/testing/testRunningReader";
import type { RunningReaderFixture } from "src/testing/types/RunningReaderFixture";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningRelease } from "src/types/RunningRelease";

vi.mock("vitest", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { collect } = await import("src/testing/collectChecks.fixture");

  return { ...actual, describe: collect.describe, test: collect.test };
});

// Registers the suite over these options, runs every check, and answers how each one ended.
const runSuite = (options: Parameters<typeof testRunningReader>[0]) =>
  runCollected(() => {
    testRunningReader(options);
  });

// A release bent out of shape on purpose, which no type would let a reader answer.
const bend = (release: object): RunningRelease =>
  Object.assign(Object.create(null), release);

const RELEASE: RunningRelease = {
  identity: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value: "build-a",
  },
  label: "Build A",
  raw: { channel: "production", embedded: false, build: 12 },
};

// A reader over a fake host that counts how often it is asked.
const createHosted = (
  read: (asked: number) => RunningRelease | Promise<RunningRelease>,
): RunningReaderFixture => {
  const host = { asked: 0 };

  return {
    reader: () => {
      host.asked += 1;

      return read(host.asked);
    },
    reads: () => host.asked,
  };
};

const CHECKS = {
  cold: "creating it asks its host for nothing",
  wired: "reading it asks its host, so the count that proves it cold is wired",
  release:
    "it answers a release that names what runs, in the shape Beacon publishes",
  stable: "it answers the same release for the same state on every read",
};

describe("a reader that keeps the contract passes every check", () => {
  test("synchronous, asynchronous and without a host", async () => {
    const hosted = await runSuite({
      name: "synchronous",
      create: () => createHosted(() => RELEASE),
    });

    const later = await runSuite({
      name: "asynchronous",
      create: () => createHosted(async () => RELEASE),
    });

    const constant = await runSuite({
      name: "constant",
      create: () => ({ reader: () => RELEASE }),
    });

    expect(hosted).toEqual({
      [CHECKS.cold]: "passed",
      [CHECKS.wired]: "passed",
      [CHECKS.release]: "passed",
      [CHECKS.stable]: "passed",
    });
    expect(later).toEqual(hosted);
    expect(constant).toEqual({
      ...hosted,
      [CHECKS.cold]: "skipped",
      [CHECKS.wired]: "skipped",
    });
  });

  test("and each situation is a check of its own", async () => {
    const outcomes = await runSuite({
      name: "with situations",
      create: () => createHosted(() => RELEASE),
      situations: [
        {
          name: "the host cannot name the build",
          answers: "unknown",
          create: () =>
            createHosted(() => ({
              identity: { status: "unknown", reason: "build-not-read" },
              label: null,
              raw: {},
            })),
        },
        {
          name: "the host is not there",
          answers: "rejection",
          create: () =>
            createHosted(() => Promise.reject(new Error("Not implemented."))),
        },
        {
          name: "the host names a build",
          answers: "known",
          create: () => createHosted(() => RELEASE),
        },
      ],
    });

    expect(outcomes).toMatchObject({
      "where the host cannot name the build, it answers unknown": "passed",
      "where the host is not there, it answers rejection": "passed",
      "where the host names a build, it answers known": "passed",
    });
    expect(listFailed(outcomes)).toEqual([]);
  });
});

describe("a reader that breaks the contract fails the check that names it", () => {
  test("a reader that asks its host when it is created", async () => {
    const outcomes = await runSuite({
      name: "eager",
      create: () => {
        const fixture = createHosted(() => RELEASE);

        fixture.reader();

        return fixture;
      },
    });

    expect(listFailed(outcomes)).toEqual([CHECKS.cold]);
  });

  test("a fixture whose count is never wired", async () => {
    const outcomes = await runSuite({
      name: "unwired",
      create: () => ({ reader: () => RELEASE, reads: () => 0 }),
    });

    expect(listFailed(outcomes)).toEqual([CHECKS.wired]);
  });

  test("a reader that throws", async () => {
    const outcomes = await runSuite({
      name: "throwing",
      create: () =>
        createHosted(() => {
          throw new Error("The host is not there.");
        }),
    });

    expect(listFailed(outcomes)).toEqual([
      CHECKS.wired,
      CHECKS.release,
      CHECKS.stable,
    ]);
  });

  test("a reader that throws where the host cannot name the build, instead of answering an unknown identity", async () => {
    const outcomes = await runSuite({
      name: "throwing in a situation",
      create: () => createHosted(() => RELEASE),
      situations: [
        {
          name: "the build is not there",
          answers: "unknown",
          create: () =>
            createHosted(() => {
              throw new Error("No build.");
            }),
        },
      ],
    });

    expect(listFailed(outcomes)).toEqual([
      "where the build is not there, it answers unknown",
    ]);
  });

  test("a reader that answers where it was to reject, and one that rejects where it was to answer", async () => {
    const outcomes = await runSuite({
      name: "mismatched",
      create: () => createHosted(() => RELEASE),
      situations: [
        {
          name: "it should reject",
          answers: "rejection",
          create: () => createHosted(() => RELEASE),
        },
        {
          name: "it should answer",
          answers: "known",
          create: () => createHosted(() => Promise.reject(new Error("No."))),
        },
        {
          name: "it should say unknown",
          answers: "unknown",
          create: () => createHosted(() => RELEASE),
        },
      ],
    });

    expect(listFailed(outcomes)).toEqual([
      "where it should reject, it answers rejection",
      "where it should answer, it answers known",
      "where it should say unknown, it answers unknown",
    ]);
  });

  test.each([
    [
      "an unknown identity in the usual state",
      {
        ...RELEASE,
        identity: {
          status: "unknown",
          reason: "not-read",
        } satisfies ReleaseIdentity,
      },
    ],
    [
      "an empty authority",
      { ...RELEASE, identity: { ...RELEASE.identity, authority: "" } },
    ],
    [
      "an empty domain",
      { ...RELEASE, identity: { ...RELEASE.identity, domain: "" } },
    ],
    [
      "an empty value",
      { ...RELEASE, identity: { ...RELEASE.identity, value: "" } },
    ],
    [
      "a value with a trailing space",
      { ...RELEASE, identity: { ...RELEASE.identity, value: "113 " } },
    ],
    [
      "a value with a leading line break",
      { ...RELEASE, identity: { ...RELEASE.identity, value: "\n113" } },
    ],
    [
      "an authority with a leading space",
      { ...RELEASE, identity: { ...RELEASE.identity, authority: " app" } },
    ],
    [
      "an unknown identity with an empty reason",
      {
        ...RELEASE,
        identity: { status: "unknown", reason: "" } satisfies ReleaseIdentity,
      },
    ],
    ["an empty label", { ...RELEASE, label: "" }],
    ["a label that is a number", { ...RELEASE, label: 12 }],
    [
      "a raw value that is undefined",
      { ...RELEASE, raw: { build: undefined } },
    ],
    ["a raw value that is an object", { ...RELEASE, raw: { build: {} } }],
    [
      "a raw value that is not finite",
      { ...RELEASE, raw: { build: Number.NaN } },
    ],
    ["a raw value that is a function", { ...RELEASE, raw: { build: () => 1 } }],
    ["a raw object of a class", { ...RELEASE, raw: new (class Raw {})() }],
  ])("%s is not a release Beacon publishes", async (_name, release) => {
    const outcomes = await runSuite({
      name: "malformed",
      create: () => createHosted(() => bend(release)),
    });

    expect(listFailed(outcomes)).toContain(CHECKS.release);
  });

  test("a reader that answers something else each time", async () => {
    const outcomes = await runSuite({
      name: "drifting",
      create: () =>
        createHosted((asked) => ({
          ...RELEASE,
          identity: { ...RELEASE.identity, value: `build-${asked}` },
        })),
    });

    expect(listFailed(outcomes)).toEqual([CHECKS.stable]);
  });

  test("a reader whose raw values change between reads", async () => {
    const outcomes = await runSuite({
      name: "raw drifting",
      create: () =>
        createHosted((asked) => ({ ...RELEASE, raw: { reads: asked } })),
    });

    expect(listFailed(outcomes)).toEqual([CHECKS.stable]);
  });
});
