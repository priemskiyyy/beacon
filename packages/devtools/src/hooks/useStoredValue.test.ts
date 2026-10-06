import { createRoot } from "solid-js";
import { afterEach, expect, test, vi } from "vitest";

import { useStoredValue } from "src/hooks/useStoredValue";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const parseCount = (raw: unknown) => {
  if (typeof raw !== "number") {
    return 0;
  }

  return raw;
};

test("it reads the stored value, writes updates, and follows another tab", () => {
  localStorage.setItem("count", "3");
  localStorage.setItem("broken", "{");

  createRoot((dispose) => {
    const [count, setCount] = useStoredValue("count", parseCount, 0);
    const [broken] = useStoredValue("broken", parseCount, 7);

    expect(count()).toBe(3);
    expect(broken()).toBe(7);

    setCount(4);
    expect(localStorage.getItem("count")).toBe("4");

    localStorage.setItem("count", "9");
    window.dispatchEvent(new StorageEvent("storage", { key: "count" }));
    expect(count()).toBe(9);

    localStorage.setItem("count", "1");
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(count()).toBe(9);
    dispose();
  });
});

test("it stops listening when its owner goes", () => {
  let read = 0;

  createRoot((dispose) => {
    const [count] = useStoredValue(
      "count",
      (raw) => {
        read += 1;

        return parseCount(raw);
      },
      0,
    );

    localStorage.setItem("count", "5");
    window.dispatchEvent(new StorageEvent("storage", { key: "count" }));
    expect(count()).toBe(5);
    dispose();
  });

  const before = read;

  window.dispatchEvent(new StorageEvent("storage", { key: "count" }));
  expect(read).toBe(before);
});

test("storage that throws leaves the fallback, and a write that throws is dropped", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });

  createRoot((dispose) => {
    const [count, setCount] = useStoredValue("count", parseCount, 7);

    expect(count()).toBe(7);
    setCount(8);
    // The value lives on in memory for this page even where nothing can be stored.
    expect(count()).toBe(8);
    dispose();
  });
});
