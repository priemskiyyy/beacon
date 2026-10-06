import { expect, test, vi } from "vitest";

import { commitChange } from "src/utils/internal/observable/commitChange";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { ValueStore } from "src/utils/internal/observable/ValueStore";

const createStore = <TValue>(value: TValue) =>
  new ValueStore(value, new Listeners(vi.fn()));

test("CORE-07 a change that throws after it set a store still tells the listeners of what it set, and the error goes on", () => {
  const first = createStore(1);
  const second = createStore("a");
  const seen: Array<[number, string]> = [];

  first.subscribe(() => seen.push([first.get(), second.get()]));

  expect(() =>
    commitChange((transaction) => {
      transaction.set(first, 2);
      transaction.set(second, "b");

      throw new Error("the change failed");
    }),
  ).toThrow("the change failed");

  // What the stores hold is what the listeners were told, and every store was installed before any listener ran.
  expect(first.get()).toBe(2);
  expect(seen).toEqual([[2, "b"]]);
});

test("a change that throws before it set anything tells nobody", () => {
  const store = createStore(1);
  const listener = vi.fn();

  store.subscribe(listener);

  expect(() =>
    commitChange(() => {
      throw new Error("the change failed");
    }),
  ).toThrow("the change failed");
  expect(listener).not.toHaveBeenCalled();
});

test("a change that completes tells the listeners once", () => {
  const store = createStore(1);
  const seen: number[] = [];

  store.subscribe(() => seen.push(store.get()));
  commitChange((transaction) => transaction.set(store, 2));

  expect(seen).toEqual([2]);
});
