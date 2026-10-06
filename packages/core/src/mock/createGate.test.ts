import { expect, test } from "vitest";

import { createGate } from "src/mock/createGate";
import { settle } from "src/mock/settle";

const watch = (gate: ReturnType<typeof createGate>) => {
  const passed = { count: 0 };

  gate.wait().then(() => {
    passed.count += 1;
  });

  return passed;
};

test("a gate that was never held lets a waiter through at once", async () => {
  const gate = createGate();
  const passed = watch(gate);

  await settle();

  expect(passed.count).toBe(1);
});

test("a held gate keeps a waiter until it is released, and then lets every waiter go", async () => {
  const gate = createGate();

  gate.hold();

  const first = watch(gate);
  const second = watch(gate);

  await settle();

  expect(first.count + second.count).toBe(0);

  gate.release();
  await settle();

  expect(first.count).toBe(1);
  expect(second.count).toBe(1);
});

test("a released gate is open for whoever comes next, and can be held again", async () => {
  const gate = createGate();

  gate.hold();
  gate.release();

  const open = watch(gate);

  await settle();

  expect(open.count).toBe(1);

  gate.hold();

  const closed = watch(gate);

  await settle();

  expect(closed.count).toBe(0);

  gate.release();
  await settle();

  expect(closed.count).toBe(1);
});

test("holding a held gate and releasing an open one change nothing more", async () => {
  const gate = createGate();

  gate.release();
  gate.hold();
  gate.hold();

  const passed = watch(gate);

  await settle();
  gate.release();
  gate.release();
  await settle();

  expect(passed.count).toBe(1);
});

test("a waiter is let go once, however often the gate is released", async () => {
  const gate = createGate();

  gate.hold();

  const passed = watch(gate);

  gate.release();
  gate.hold();
  gate.release();
  await settle();

  expect(passed.count).toBe(1);
});
