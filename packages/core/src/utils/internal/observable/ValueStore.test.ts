import { expect, test, vi } from "vitest";

import { Listeners } from "src/utils/internal/observable/Listeners";
import { ValueStore } from "src/utils/internal/observable/ValueStore";

const createStore = <TValue>(value: TValue) =>
  new ValueStore(value, new Listeners(vi.fn()));

test("setting installs without notifying and answers whether the value changed", () => {
  const store = createStore(1);
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
  const store = createStore(value);
  const listener = vi.fn();

  store.subscribe(listener);
  store.update(value);

  expect(store.get()).toBe(value);
  expect(listener).not.toHaveBeenCalled();
});

test("an update notifies only a change", () => {
  const store = createStore("a");
  const listener = vi.fn();

  store.subscribe(listener);
  store.update("a");
  store.update("b");

  expect(listener).toHaveBeenCalledTimes(1);
});

test("CORE-01 subscribing never calls back at once and the readable keeps its identity", () => {
  const store = createStore({ value: 1 });
  const listener = vi.fn();
  const { observable } = store;

  observable.subscribe(listener);

  expect(listener).not.toHaveBeenCalled();
  expect(store.observable).toBe(observable);
  expect(observable.get()).toBe(observable.get());
  expect(Object.isFrozen(observable)).toBe(true);
});

test("a closed store keeps its value, stops notifying and refuses listeners and new values", () => {
  const store = createStore(1);
  const listener = vi.fn();

  store.subscribe(listener);
  store.close();
  store.update(2);

  const unsubscribe = store.subscribe(listener);

  store.update(3);
  unsubscribe();

  expect(store.get()).toBe(1);
  expect(listener).not.toHaveBeenCalled();
});

test("the read side works detached from the store", () => {
  const store = createStore(1);
  const { get, subscribe } = store.observable;
  const listener = vi.fn();

  subscribe(listener);
  store.update(2);

  expect(get()).toBe(2);
  expect(listener).toHaveBeenCalledTimes(1);
});

test("CORE-01 the initial value stays readable however the value changes", () => {
  const store = createStore({ count: 0 });

  store.update({ count: 1 });

  expect(store.get()).toEqual({ count: 1 });
  expect(store.observable.getInitial()).toEqual({ count: 0 });
  expect(store.observable.getInitial()).toBe(store.getInitial());
});
