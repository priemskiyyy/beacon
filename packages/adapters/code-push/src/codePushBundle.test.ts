import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { codePushBundle } from "src/codePushBundle";
import {
  fakeCodePush,
  HASH_A,
  HASH_B,
  localPackage,
  SCOPE,
} from "src/fakeCodePush.fixture";

test("the running bundle is the package CodePush says runs, named by its hash", async () => {
  const { codePush } = fakeCodePush({
    running: localPackage(HASH_A, { label: "v3" }),
  });

  await expect(codePushBundle(codePush)()).resolves.toEqual({
    identity: {
      status: "known",
      authority: "code-push",
      domain: "package-hash",
      value: HASH_A,
    },
    label: "v3",
    raw: { label: "v3", embedded: false },
  });
});

test("the bundle inside the binary has no identity: CodePush reports no package for it", async () => {
  const { codePush } = fakeCodePush();

  await expect(codePushBundle(codePush)()).resolves.toEqual({
    identity: { status: "unknown", reason: "embedded-bundle" },
    label: null,
    raw: { label: null, embedded: true },
  });
});

test("a package that sits on disk while the binary's own bundle runs is not the running bundle", async () => {
  const { codePush } = fakeCodePush({
    running: { ...localPackage(HASH_A), _isDebugOnly: true },
  });

  await expect(codePushBundle(codePush)()).resolves.toMatchObject({
    identity: { status: "unknown", reason: "embedded-bundle" },
    raw: { embedded: true },
  });
});

test("a running package with no hash has no identity, and is never the text undefined", async () => {
  const { codePush } = fakeCodePush({ running: localPackage(" ") });

  await expect(codePushBundle(codePush)()).resolves.toMatchObject({
    identity: { status: "unknown", reason: "package-hash-missing" },
  });
});

test("the reader asks for what runs, and never for what is pending", async () => {
  const fake = fakeCodePush({ running: localPackage(HASH_A) });

  fake.setPending(localPackage(HASH_B));

  await expect(codePushBundle(fake.codePush)()).resolves.toMatchObject({
    identity: { value: HASH_A },
  });
  expect(fake.metadata).toEqual([fake.updateState.RUNNING]);
});

test("the reader looks at CodePush when it is read, not when it is created", async () => {
  const fake = fakeCodePush({ running: localPackage(HASH_A) });
  const read = codePushBundle(fake.codePush);

  expect(fake.metadata).toEqual([]);

  fake.setRunning(localPackage(HASH_B));

  await expect(read()).resolves.toMatchObject({ identity: { value: HASH_B } });
});

test("a reader whose CodePush fails passes the failure on, and the route's running fact says it failed", async () => {
  const fake = fakeCodePush();

  fake.codePush.getUpdateMetadata = async () => {
    throw new Error("no native module");
  };

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      bundle: codePushBundle(fake.codePush),
    },
    routes: {},
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();

  await expect(codePushBundle(fake.codePush)()).rejects.toThrow(
    "no native module",
  );
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(beacon.running.get().bundle).toMatchObject({ state: "failed" });
});
