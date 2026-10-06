import { expect, test, vi } from "vitest";

import { ValueStore } from "src/utils/internal/observable/ValueStore";

test("setting installs without notifying and answers whether the value changed", () => {
  const store = new ValueStore(1);
  const listener = vi.fn();

  store.subscribe(listener);

  expect(store.set(1)).toBe(false);
  expect(store.set(2)).toBe(true);
  expect(store.get()).toBe(2);
  expect(listener).not.toHaveBeenCalled();

  store.notify();
  expect(listener).toHaveBeenCalledTimes(1);
});

test("CORE-06 an equal value notifies nobody and keeps the snapshot", () => {
  const value = { revision: 1 };
  const store = new ValueStore(value);
  const listener = vi.fn();

  store.subscribe(listener);
  store.update(value);

  expect(store.get()).toBe(value);
  expect(listener).not.toHaveBeenCalled();
});

test("an update notifies only a change", () => {
  const store = new ValueStore("a");
  const listener = vi.fn();

  store.subscribe(listener);
  store.update("a");
  store.update("b");

  expect(listener).toHaveBeenCalledTimes(1);
});

test("CORE-01 subscribing never calls back at once and the readable keeps its identity", () => {
  const store = new ValueStore({ value: 1 });
  const listener = vi.fn();
  const { observable } = store;

  observable.subscribe(listener);

  expect(listener).not.toHaveBeenCalled();
  expect(store.observable).toBe(observable);
  expect(observable.get()).toBe(observable.get());
  expect(Object.isFrozen(observable)).toBe(true);
});

test("a closed store keeps its value, stops notifying and refuses listeners", () => {
  const store = new ValueStore(1);
  const listener = vi.fn();

  store.subscribe(listener);
  store.close();
  store.update(2);

  const unsubscribe = store.subscribe(listener);

  store.update(3);
  unsubscribe();

  expect(store.get()).toBe(3);
  expect(listener).not.toHaveBeenCalled();
});

test("the read side works detached from the store", () => {
  const store = new ValueStore(1);
  const { get, subscribe } = store.observable;
  const listener = vi.fn();

  subscribe(listener);
  store.update(2);

  expect(get()).toBe(2);
  expect(listener).toHaveBeenCalledTimes(1);
});
