import { expect, test } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import { createTestClock } from "src/mock/createTestClock";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { SourceReadContext } from "src/types/SourceReadContext";

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

const startRead = (
  mock: ReturnType<typeof createMockSource<{ web: string }>>,
  attempt: number,
  controller = new AbortController(),
) => {
  const context: SourceReadContext = {
    scope: SCOPE,
    signal: controller.signal,
    attempt,
    clock: createTestClock(),
  };

  return mock.source.read(context);
};

test("a read is held until the test settles it, oldest first", async () => {
  const mock = createMockSource<{ web: string }>();

  const first = startRead(mock, 1);
  const second = startRead(mock, 2);

  expect(mock.stats()).toEqual({ reads: 2, held: 2, aborted: 0 });

  mock.resolve({ document: { web: "first" } });

  await expect(first).resolves.toEqual({ document: { web: "first" } });
  expect(mock.stats().held).toBe(1);

  mock.resolve({ document: { web: "second" } });

  await expect(second).resolves.toEqual({ document: { web: "second" } });
  expect(mock.stats().held).toBe(0);
});

test("reject settles the oldest held read with the failure", async () => {
  const mock = createMockSource<{ web: string }>();

  const first = startRead(mock, 1);
  const second = startRead(mock, 2);

  mock.reject(new Error("offline"));

  await expect(first).rejects.toThrow("offline");
  expect(mock.stats().held).toBe(1);

  mock.resolve({ document: { web: "second" } });

  await expect(second).resolves.toEqual({ document: { web: "second" } });
});

test("an answer settles every later read at once until reads are held again", async () => {
  const mock = createMockSource<{ web: string }>();

  mock.answer({ document: { web: "answered" } });

  await expect(startRead(mock, 1)).resolves.toEqual({
    document: { web: "answered" },
  });
  expect(mock.stats()).toEqual({ reads: 1, held: 0, aborted: 0 });

  mock.hold();

  const held = startRead(mock, 2);

  expect(mock.stats()).toEqual({ reads: 2, held: 1, aborted: 0 });

  mock.resolve({ document: { web: "settled" } });

  await expect(held).resolves.toEqual({ document: { web: "settled" } });
});

test("resolving or rejecting with nothing held throws, and settles nothing", () => {
  const mock = createMockSource<{ web: string }>();

  expect(() => mock.resolve({ document: { web: "none" } })).toThrow(
    "The mock source has no held read to settle.",
  );
  expect(() => mock.reject(new Error("none"))).toThrow(
    "The mock source has no held read to settle.",
  );
});

test("a read whose signal aborted is counted, and can still be settled late", async () => {
  const mock = createMockSource<{ web: string }>();
  const controller = new AbortController();

  const late = startRead(mock, 1, controller);

  controller.abort();

  expect(mock.stats()).toEqual({ reads: 1, held: 1, aborted: 1 });

  mock.resolve({ document: { web: "late" } });

  await expect(late).resolves.toEqual({ document: { web: "late" } });
});

test("a read that starts with its signal already aborted is counted too", () => {
  const mock = createMockSource<{ web: string }>();
  const controller = new AbortController();

  controller.abort();
  startRead(mock, 1, controller);

  expect(mock.stats().aborted).toBe(1);
});

test("the contexts are what each read was given, oldest first, and a copy", () => {
  const mock = createMockSource<{ web: string }>({ name: "manifest" });

  startRead(mock, 1);
  startRead(mock, 2);

  const contexts = mock.contexts();

  expect(mock.source.name).toBe("manifest");
  expect(contexts.map(({ attempt }) => attempt)).toEqual([1, 2]);
  expect(contexts[0]?.scope).toEqual(SCOPE);

  contexts.length = 0;

  expect(mock.contexts()).toHaveLength(2);
});
