import { expect, test, vi } from "vitest";

import { settle } from "src/utils/Beacon.fixture";

import { createDeferred } from "src/utils/internal/common/createDeferred";
import { untilAborted } from "src/utils/internal/common/untilAborted";

test("untilAborted answers the value when the work settles first", async () => {
  const work = createDeferred<number>();
  const controller = new AbortController();
  const raced = untilAborted(work.promise, controller.signal);

  work.resolve(7);

  expect(await raced).toEqual({ status: "settled", value: 7 });
});

test("untilAborted answers aborted and leaves the work running", async () => {
  const work = createDeferred<number>();
  const controller = new AbortController();
  const raced = untilAborted(work.promise, controller.signal);

  controller.abort();

  expect(await raced).toEqual({ status: "aborted" });

  work.resolve(1);

  expect(await work.promise).toBe(1);
});

test("untilAborted answers aborted at once for a signal that already ended", async () => {
  const controller = new AbortController();

  controller.abort();

  expect(await untilAborted(Promise.resolve(1), controller.signal)).toEqual({
    status: "aborted",
  });
});

test("untilAborted rejects when the work rejects first", async () => {
  const work = createDeferred<number>();
  const controller = new AbortController();
  const raced = untilAborted(work.promise, controller.signal);

  work.reject(new Error("broken"));

  await expect(raced).rejects.toThrow("broken");
});

test("untilAborted leaves the failure of work it no longer waits for to nobody, so it is never unhandled", async () => {
  const controller = new AbortController();

  controller.abort();

  const raced = await untilAborted(
    Promise.reject(new Error("nobody waits")),
    controller.signal,
  );

  await settle();

  expect(raced).toEqual({ status: "aborted" });
});

test("untilAborted stops listening to the signal once the work has settled", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");

  await untilAborted(Promise.resolve(1), controller.signal);
  await settle();

  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});
