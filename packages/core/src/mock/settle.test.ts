import { expect, test } from "vitest";

import { settle } from "src/mock/settle";

test("every queued promise continuation has run when the test goes on", async () => {
  const done = { count: 0 };

  let chain = Promise.resolve();

  for (let step = 0; step < 50; step += 1) {
    chain = chain.then(() => {
      done.count += 1;
    });
  }

  await settle();

  expect(done.count).toBe(50);
});

test("a timer of the host that was already due has run when the test goes on", async () => {
  const order: string[] = [];

  setTimeout(() => {
    order.push("timer");
  }, 0);

  await settle();
  order.push("settled");

  expect(order).toEqual(["timer", "settled"]);
});
