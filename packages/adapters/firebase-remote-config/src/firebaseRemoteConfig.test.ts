import { createTestClock } from "@priemskiyyy/beacon/mock";
import { integer } from "@priemskiyyy/beacon/versions";
import { expect, test } from "vitest";

import {
  fakeRemoteConfig,
  HOUR,
  SCOPE,
  START,
} from "src/fakeRemoteConfig.fixture";
import type { FakeOptions } from "src/fakeRemoteConfig.fixture";
import { firebaseRemoteConfig } from "src/firebaseRemoteConfig";
import type { RemoteParameters } from "src/types/RemoteParameters";

const buildRead = () => ({
  scope: SCOPE,
  signal: new AbortController().signal,
  attempt: 1,
});

const minimumBuild = ({ remote }: RemoteParameters) => ({
  minimumBuild: remote("minimum_build"),
});

// The server answers a minimum build of 120 unless a test says otherwise.
const create = (options: Omit<FakeOptions, "now"> = {}) => {
  const clock = createTestClock({ now: START });
  const fake = fakeRemoteConfig({ now: clock.now, ...options });

  fake.serve({ minimum_build: "120" });

  return { clock, fake };
};

const createSource = (fake: ReturnType<typeof create>["fake"]) =>
  firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: minimumBuild,
  });

test("creating the source, and selecting from it, asks the SDK for nothing", () => {
  const { fake } = create();

  createSource(fake).select((document) => document.minimumBuild);

  expect(fake.log).toEqual([]);
});

test("the source is named for diagnostics, and firebase-remote-config by default", () => {
  const { fake } = create();

  expect(createSource(fake).name).toBe("firebase-remote-config");

  expect(
    firebaseRemoteConfig({
      remoteConfig: fake.remoteConfig,
      sdk: fake.sdk,
      document: minimumBuild,
      name: "support-gate",
    }).name,
  ).toBe("support-gate");
});

test("a read initializes the SDK, then fetches and activates, and only then reads a value", async () => {
  const { fake } = create();

  await createSource(fake).read(buildRead());

  const [first, second, ...values] = fake.log;

  expect([first, second]).toEqual(["ensureInitialized", "fetchAndActivate"]);
  expect(values.length).toBeGreaterThan(0);
  expect(values.every((entry) => entry.startsWith("getValue "))).toBe(true);
});

test("the answer is the document and its expiry, and names no revision, digest or issuer, since Firebase exposes no template version", async () => {
  const { fake } = create();

  await expect(createSource(fake).read(buildRead())).resolves.toStrictEqual({
    document: { minimumBuild: "120" },
    expiresAt: START + 12 * HOUR,
  });
});

test("the answer holds until the fetch is as old as the minimum fetch interval, which is when the SDK would ask the server again", async () => {
  const { fake } = create({ interval: 2 * HOUR });

  const answer = await createSource(fake).read(buildRead());

  expect(answer.expiresAt).toBe(START + 2 * HOUR);
});

test("maxAge replaces the interval, shorter or longer, and is counted from the fetch", async () => {
  const { fake } = create();

  const options = {
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: minimumBuild,
  };

  const shorter = await firebaseRemoteConfig({ ...options, maxAge: HOUR }).read(
    buildRead(),
  );

  const longer = await firebaseRemoteConfig({
    ...options,
    maxAge: 48 * HOUR,
  }).read(buildRead());

  expect(shorter.expiresAt).toBe(START + HOUR);
  expect(longer.expiresAt).toBe(START + 48 * HOUR);
});

test("a second read inside the interval is answered from the SDK's cache, with the time of the fetch that got the values", async () => {
  const { clock, fake } = create();
  const source = createSource(fake);

  const first = await source.read(buildRead());

  clock.advance(5 * HOUR);

  const second = await source.read(buildRead());

  expect(fake.calls.network).toBe(1);
  expect(fake.calls.fetchAndActivate).toBe(2);
  expect(second.expiresAt).toBe(first.expiresAt);
});

test("a read after the interval reaches the server again, and the new values carry the new time", async () => {
  const { clock, fake } = create();
  const source = createSource(fake);

  await source.read(buildRead());

  clock.advance(13 * HOUR);
  fake.serve({ minimum_build: "130" });

  await expect(source.read(buildRead())).resolves.toStrictEqual({
    document: { minimumBuild: "130" },
    expiresAt: START + 13 * HOUR + 12 * HOUR,
  });
  expect(fake.calls.network).toBe(2);
});

test("the time of the last fetch is the instance's, and never the fetch timeout that React Native Firebase's settings also call fetchTimeMillis", async () => {
  const { fake } = create();

  const answer = await createSource(fake).read(buildRead());

  expect(fake.remoteConfig.settings.fetchTimeMillis).toBe(60_000);
  expect(answer.expiresAt).toBe(START + 12 * HOUR);
});

test.each([
  ["the web and Android", -1],
  ["iOS", 0],
])(
  "a configuration that never fetched answers nothing, as %s say it (%d), even with a default for the key",
  async (_, never) => {
    const { fake } = create({ never, defaults: { minimum_build: "0" } });

    fake.fail(new Error("offline"));

    const source = firebaseRemoteConfig({
      remoteConfig: fake.remoteConfig,
      sdk: fake.sdk,
      document: minimumBuild,
      onFetchFailure: "use-activated",
    });

    await expect(source.read(buildRead())).rejects.toMatchObject({
      code: "SOURCE_FAILED",
      message: expect.stringContaining("never fetched"),
    });
  },
);

test("a value the server sent is its text, and an empty text is a text", async () => {
  const { fake } = create();

  fake.serve({ minimum_build: "" });

  await expect(createSource(fake).read(buildRead())).resolves.toMatchObject({
    document: { minimumBuild: "" },
  });
});

const expectRefused = async (fake: ReturnType<typeof create>["fake"]) => {
  await expect(createSource(fake).read(buildRead())).rejects.toMatchObject({
    code: "SOURCE_FAILED",
    message: expect.stringContaining("minimum_build"),
  });
};

test("a default of the application is never a server's answer: remote() throws and the read fails", async () => {
  const { fake } = create({ defaults: { minimum_build: "0" } });

  fake.serve({});

  await expectRefused(fake);
});

test("a key nothing defines is never a server's answer either", async () => {
  const { fake } = create();

  fake.serve({ other_key: "1" });

  await expectRefused(fake);
});

test("a value the SDK says is from a source it does not name, such as the iOS module's unknown, is not a server's answer", async () => {
  const { fake } = create();

  fake.force("minimum_build", "unknown");

  await expectRefused(fake);
});

test("source() tells where each key's value comes from, and only remote is a server's", async () => {
  const { fake } = create({ defaults: { from_default: "1" } });

  fake.serve({ from_server: "1", odd: "1" });
  fake.force("odd", "unknown");

  const answer = await firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: ({ source }) => ({
      server: source("from_server"),
      fallback: source("from_default"),
      nowhere: source("nothing"),
      odd: source("odd"),
    }),
  }).read(buildRead());

  expect(answer.document).toEqual({
    server: "remote",
    fallback: "default",
    nowhere: "missing",
    odd: "missing",
  });
});

test("a fetch that fails fails the read with what the SDK threw, unwrapped, and a document is never built", async () => {
  const { fake } = create();
  const failure = new Error("fetch failed");
  const builds: string[] = [];

  fake.fail(failure);

  const source = firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: (parameters) => {
      builds.push("built");

      return minimumBuild(parameters);
    },
  });

  await expect(source.read(buildRead())).rejects.toBe(failure);
  expect(builds).toEqual([]);
});

test("a fetch that throws at once is a failed fetch too", async () => {
  const { fake } = create();
  const failure = new Error("not a promise");

  const source = firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: {
      ...fake.sdk,
      fetchAndActivate: () => {
        throw failure;
      },
    },
    document: minimumBuild,
  });

  await expect(source.read(buildRead())).rejects.toBe(failure);
});

test("use-activated answers with the values activated earlier, dated by the fetch that got them", async () => {
  const at = START - 48 * HOUR;
  const { fake } = create({ stored: { at, config: { minimum_build: "120" } } });

  fake.fail(new Error("offline"));

  const answer = await firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: minimumBuild,
    onFetchFailure: "use-activated",
  }).read(buildRead());

  expect(answer).toStrictEqual({
    document: { minimumBuild: "120" },
    expiresAt: at + 12 * HOUR,
  });
});

test("the values activated earlier are in the SDK only once it is initialized, so the read initializes it before it fetches", async () => {
  const at = START - HOUR;
  const { fake } = create({ stored: { at, config: { minimum_build: "120" } } });

  expect(fake.remoteConfig.fetchTimeMillis).toBe(-1);

  await expect(createSource(fake).read(buildRead())).resolves.toStrictEqual({
    document: { minimumBuild: "120" },
    expiresAt: at + 12 * HOUR,
  });

  expect(fake.log.slice(0, 2)).toEqual([
    "ensureInitialized",
    "fetchAndActivate",
  ]);
});

test.each<"fail" | "use-activated">(["fail", "use-activated"])(
  "an SDK that cannot initialize fails the read in %s mode, and nothing is fetched",
  async (onFetchFailure) => {
    const { fake } = create({
      stored: { at: START - HOUR, config: { minimum_build: "120" } },
    });

    const failure = new Error("storage unavailable");

    fake.failInitialization(failure);

    const source = firebaseRemoteConfig({
      remoteConfig: fake.remoteConfig,
      sdk: fake.sdk,
      document: minimumBuild,
      onFetchFailure,
    });

    await expect(source.read(buildRead())).rejects.toBe(failure);
    expect(fake.calls.fetchAndActivate).toBe(0);
  },
);

test("any other onFetchFailure than use-activated fails the read, for a caller the types do not reach", async () => {
  const { fake } = create({
    stored: { at: START - 48 * HOUR, config: { minimum_build: "120" } },
  });

  fake.fail(new Error("offline"));

  // The types forbid this option, and a caller written in JavaScript can still give it.
  const untyped = JSON.parse('{"onFetchFailure":"use_activated"}');

  const source = firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: minimumBuild,
    ...untyped,
  });

  await expect(source.read(buildRead())).rejects.toThrow("offline");
});

test("a document that throws fails the read with what it threw, and a BeaconError keeps its code", async () => {
  const { fake } = create();
  const cause = new Error("not a build");
  const build = integer();

  const failing = firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: () => {
      throw cause;
    },
  });

  fake.serve({ minimum_build: "v120" });

  const strict = firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: ({ remote }) => ({
      minimumBuild: build.parse(remote("minimum_build")),
    }),
  });

  await expect(failing.read(buildRead())).rejects.toBe(cause);
  await expect(strict.read(buildRead())).rejects.toMatchObject({
    code: "INVALID_VERSION",
  });
});

test("an SDK that throws while a value is read fails the read as it threw", async () => {
  const { fake } = create();
  const failure = new Error("native module gone");

  const source = firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: {
      ...fake.sdk,
      getValue: () => {
        throw failure;
      },
    },
    document: minimumBuild,
  });

  await expect(source.read(buildRead())).rejects.toBe(failure);
});

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  "a maxAge of %d is refused when the source is made, before any read",
  (maxAge) => {
    const { fake } = create();

    expect(() =>
      firebaseRemoteConfig({
        remoteConfig: fake.remoteConfig,
        sdk: fake.sdk,
        document: minimumBuild,
        maxAge,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));

    expect(fake.log).toEqual([]);
  },
);

test("the source calls three functions of the module and sets nothing on the instance", async () => {
  const { fake } = create();
  const called: string[] = [];

  const forbidden = (name: string) => () => {
    called.push(name);
  };

  // A real module has these and more, and the source has no use for any of them.
  const sdk = {
    ...fake.sdk,
    activate: forbidden("activate"),
    fetchConfig: forbidden("fetchConfig"),
    onConfigUpdate: forbidden("onConfigUpdate"),
    setCustomSignals: forbidden("setCustomSignals"),
    setLogLevel: forbidden("setLogLevel"),
    getAll: forbidden("getAll"),
  };

  // An instance that refuses every write, as a frozen one does.
  Object.freeze(fake.remoteConfig);
  Object.freeze(fake.remoteConfig.settings);

  await firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk,
    document: minimumBuild,
  }).read(buildRead());

  expect(called).toEqual([]);
});

test("the source keeps nothing of a scope: each read asks the SDK again, whichever scope it is for", async () => {
  const { fake } = create();
  const source = createSource(fake);

  await source.read(buildRead());
  await source.read({
    ...buildRead(),
    scope: { ...SCOPE, partition: "alice" },
  });

  expect(fake.calls.fetchAndActivate).toBe(2);
  expect(fake.calls.ensureInitialized).toBe(2);
});
