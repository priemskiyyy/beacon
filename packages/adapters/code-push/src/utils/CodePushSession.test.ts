import { BeaconError } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { fakeCodePush, HASH_A, HASH_B } from "src/fakeCodePush.fixture";
import type { CodePushOffer } from "src/types/CodePushOffer";
import { CodePushSession } from "src/utils/CodePushSession";

const open = () => {
  const fake = fakeCodePush();
  const native = { codePush: fake.codePush };

  const session = new CodePushSession({
    native,
    emit: { observation: () => {}, prepared: () => {}, progress: () => {} },
  });

  return { ...fake, native, session, signal: new AbortController().signal };
};

const checked = async (context: ReturnType<typeof open>, hash: string) => {
  context.willCheck(context.remotePackage(hash));

  const draft = await context.session.check({ signal: context.signal });

  if (draft.status !== "available") {
    throw new Error("The check has no offer.");
  }

  return draft.offer;
};

test("a session is found by the handle it opened, until it is disposed", () => {
  const { native, session } = open();

  expect(CodePushSession.of(native)).toBe(session);

  session.dispose();

  expect(() => CodePushSession.of(native)).toThrow(BeaconError);
});

test("a handle no session opened is a provider that is not open", () => {
  const { codePush } = fakeCodePush();

  expect(() => CodePushSession.of({ codePush })).toThrow(
    expect.objectContaining({ code: "DRIVER_FAILED" }),
  );
});

test("an offer for a package an answer since replaced is stale, and the package it names is not downloaded", async () => {
  const context = open();
  const first = await checked(context, HASH_A);

  await checked(context, HASH_B);

  await expect(
    context.session.download(first, context.signal),
  ).resolves.toEqual({ status: "stale" });
  expect(context.calls.downloads).toBe(0);
});

test("the package a check found is dropped when the session is disposed", async () => {
  const context = open();
  const offer = await checked(context, HASH_A);

  context.session.dispose();

  await expect(
    context.session.download(offer, context.signal),
  ).resolves.toEqual({ status: "stale" });
  expect(context.calls.downloads).toBe(0);
});

test("an offer that names nothing is refused before the package the check found is looked for", async () => {
  const context = open();

  await checked(context, HASH_A);

  const offer: CodePushOffer = {
    release: {
      identity: { status: "unknown", reason: "package-hash-missing" },
    },
    label: null,
    mandatory: false,
    failedInstall: false,
  };

  await expect(
    context.session.download(offer, context.signal),
  ).resolves.toEqual({ status: "unsupported", reason: "package-hash-missing" });
});
