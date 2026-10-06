import { expect, test } from "vitest";

const probe = (read: () => unknown) => {
  try {
    return { status: "returned", value: read() };
  } catch (error) {
    return { status: "threw", error };
  }
};

test("Web Crypto is not there, so an id minted with it fails as it does in Hermes", () => {
  expect(typeof crypto).toBe("undefined");
  expect(probe(() => crypto.randomUUID()).status).toBe("threw");
  expect(probe(() => crypto.getRandomValues(new Uint8Array(1))).status).toBe(
    "threw",
  );
});

test("structuredClone, the text decoder, Buffer and WeakRef are not there, and the encoder is", () => {
  expect(typeof structuredClone).toBe("undefined");
  expect(typeof TextDecoder).toBe("undefined");
  expect(typeof Buffer).toBe("undefined");
  expect(typeof WeakRef).toBe("undefined");
  expect(typeof TextEncoder).toBe("function");
});

test("the library functions that either Hermes lacks are removed", () => {
  const iterator = [][Symbol.iterator]();

  // Named by string, since the compiler's library stops at ES2022 and so cannot spell them.
  expect(Reflect.has(Promise, "withResolvers")).toBe(false);
  expect(Reflect.has(Promise, "try")).toBe(false);
  expect(Reflect.has(Object, "groupBy")).toBe(false);
  expect(Reflect.has(Map, "groupBy")).toBe(false);
  expect(Reflect.has(Array, "fromAsync")).toBe(false);
  expect(Reflect.has([], "toSorted")).toBe(false);
  expect(Reflect.has(String.prototype, "isWellFormed")).toBe(false);
  expect(Reflect.has(new Set(), "union")).toBe(false);
  expect(Reflect.has(iterator, "map")).toBe(false);
  expect(Reflect.has(Intl, "Segmenter")).toBe(false);
  expect(typeof Intl.DateTimeFormat).toBe("function");
});

test("the ones both Hermes have stay", () => {
  expect(Object.hasOwn({ a: 1 }, "a")).toBe(true);
  expect([1, 2, 3].at(-1)).toBe(3);
  expect(Reflect.has([], "toReversed")).toBe(true);
  expect(Reflect.has([], "toSpliced")).toBe(true);
  expect(new Error("outer", { cause: "inner" }).cause).toBe("inner");
  expect(typeof queueMicrotask).toBe("function");
});

test("an abort signal is React Native's: no reason, no throwIfAborted, no statics", () => {
  const controller = new AbortController();

  controller.abort();

  expect(controller.signal.aborted).toBe(true);
  expect("reason" in controller.signal).toBe(false);
  expect("throwIfAborted" in controller.signal).toBe(false);
  expect("timeout" in AbortSignal).toBe(false);
  expect("any" in AbortSignal).toBe(false);
  expect("abort" in AbortSignal).toBe(false);
});

test("an abort listener added once runs once, as event-target-shim delivers it", () => {
  const controller = new AbortController();
  const heard: string[] = [];

  controller.signal.addEventListener("abort", () => heard.push("abort"), {
    once: true,
  });
  controller.abort();
  controller.abort();

  expect(heard).toEqual(["abort"]);
});

test("the window is the global object, and there is no document", () => {
  expect(window).toBe(globalThis);
  expect(self).toBe(globalThis);
  expect(navigator).toEqual({ product: "ReactNative" });
  expect(typeof document).toBe("undefined");
  expect(typeof localStorage).toBe("undefined");
});

test("a URL is React Native's while a test runs: no canParse, and a relative URL is not refused", () => {
  const url = new URL("https://example.com/releases?channel=beta#top");

  expect(url.hostname).toBe("example.com");
  expect(url.pathname).toBe("/releases");
  expect(url.searchParams.get("channel")).toBe("beta");
  expect("canParse" in URL).toBe(false);
  expect(new URL("not a url").href).toBe("not a url");
});

test("a URLSearchParams cuts a value at its second '=', as React Native's does", () => {
  expect(new URLSearchParams("a=b=c").get("a")).toBe("b");
});

// Each answer was read from Hermes V1 and from classic, which agree, where V8
// answers NaN for all but the last two.
test.each([
  ["2026-00-02T09:15:00Z", "2025-12-02T09:15:00.000Z"],
  ["2026-13-02T09:15:00Z", "2027-01-02T09:15:00.000Z"],
  ["2026-09-00T09:15:00Z", "2026-08-31T09:15:00.000Z"],
  ["2026-09-32T09:15:00Z", "2026-10-02T09:15:00.000Z"],
  ["2026-09-02T25:15:00Z", "2026-09-03T01:15:00.000Z"],
  ["2026-09-02T24:30:00Z", "2026-09-03T00:30:00.000Z"],
  ["2026-09-02T09:60:00Z", "2026-09-02T10:00:00.000Z"],
  ["2026-09-02T09:15:60Z", "2026-09-02T09:16:00.000Z"],
  ["2026-02-30T09:15:00Z", "2026-03-02T09:15:00.000Z"],
  ["2026-09-02T09:15:00.12Z", "2026-09-02T09:15:00.120Z"],
  ["2026-09-02", "2026-09-02T00:00:00.000Z"],
])("Date.parse reads %s as %s, as Hermes does", (text, instant) => {
  expect(new Date(Date.parse(text)).toISOString()).toBe(instant);
});

test("Date.parse leaves to the engine what is not a UTC timestamp", () => {
  expect(Number.isNaN(Date.parse("yesterday"))).toBe(true);
  expect(Date.parse("2026-09-02T09:15:00+02:00")).toBe(
    Date.parse("2026-09-02T07:15:00Z"),
  );
});
