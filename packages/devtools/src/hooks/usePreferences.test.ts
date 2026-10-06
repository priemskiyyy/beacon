import { createRoot } from "solid-js";
import { afterEach, expect, test, vi } from "vitest";

import { usePreferences } from "src/hooks/usePreferences";
import { PREFERENCES_KEY } from "src/utils/constants/defaults";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test("it reads what is stored, keeps what is valid, and merges each update into the stored value", () => {
  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({ isOpen: true, position: "sideways", height: 300 }),
  );

  createRoot((dispose) => {
    const { preferences, update } = usePreferences();

    expect(preferences()).toEqual({ isOpen: true, height: 300 });

    update({ position: "right" });
    expect(preferences()).toEqual({
      isOpen: true,
      height: 300,
      position: "right",
    });
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "null")).toEqual(
      { isOpen: true, height: 300, position: "right" },
    );
    dispose();
  });
});

test("nothing stored, and a text that is not JSON, are the defaults", () => {
  createRoot((dispose) => {
    expect(usePreferences().preferences()).toEqual({});
    localStorage.setItem(PREFERENCES_KEY, "{");
    expect(usePreferences().preferences()).toEqual({});
    dispose();
  });
});

test("storage that throws leaves the defaults, and a write that throws is dropped but kept in memory", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });

  createRoot((dispose) => {
    const { preferences, update } = usePreferences();

    expect(preferences()).toEqual({});
    update({ height: 300 });
    expect(preferences()).toEqual({ height: 300 });
    dispose();
  });
});
