// @vitest-environment jsdom
import { testJournalStorage } from "@priemskiyyy/beacon/testing";
import { beforeEach, expect, onTestFinished, test } from "vitest";

import { browserStorage } from "src/browserStorage";

// The same storage over the real global window of jsdom, whose Storage is the interface a browser has: the fake of the other tests is held to it here. A real browser's eviction, its private modes and its quota are not.
const KEY = "beacon/v1/com.example.notes/production/web/public-web";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

testJournalStorage({
  name: "browser sessionStorage of jsdom",
  create: () => ({
    storage: browserStorage(),
    reopen: () => browserStorage(),
  }),
});

testJournalStorage({
  name: "browser localStorage of jsdom",
  create: () => ({
    storage: browserStorage({ area: "local" }),
    reopen: () => browserStorage({ area: "local" }),
  }),
});

test("each area is the real one, and a record stays where it was written", async () => {
  await browserStorage().write(KEY, "tab");
  await browserStorage({ area: "local" }).write(KEY, "every tab");

  expect(window.sessionStorage.getItem(KEY)).toBe("tab");
  expect(window.localStorage.getItem(KEY)).toBe("every tab");

  await browserStorage().remove(KEY);

  expect(window.sessionStorage.getItem(KEY)).toBeNull();
  expect(window.localStorage.getItem(KEY)).toBe("every tab");
});

test("a full storage rejects the write with the browser's own QuotaExceededError", async () => {
  // jsdom counts 5,000,000 characters, the quota its localStorage keeps.
  window.localStorage.setItem("fill", "x".repeat(4_999_000));

  await expect(
    browserStorage({ area: "local" }).write(KEY, "y".repeat(2_000)),
  ).rejects.toMatchObject({ name: "QuotaExceededError" });
  expect(window.localStorage.getItem(KEY)).toBeNull();
});

test("a window whose storage property throws, as in a sandboxed frame, rejects the call with the SecurityError as the cause", async () => {
  const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");

  if (original === undefined) {
    throw new Error("The window has no sessionStorage of its own to put back.");
  }

  onTestFinished(() => {
    Object.defineProperty(window, "sessionStorage", original);
  });

  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    get: () => {
      throw new DOMException(
        "Failed to read the 'sessionStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.",
        "SecurityError",
      );
    },
  });

  await expect(browserStorage().read(KEY)).rejects.toMatchObject({
    message: expect.stringContaining("refuses web storage"),
    cause: { name: "SecurityError" },
  });
});
