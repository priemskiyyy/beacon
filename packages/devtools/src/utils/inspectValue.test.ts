import { expect, test, vi } from "vitest";

import { inspectValue } from "src/utils/inspectValue";

const secretNames = [
  "token",
  "accessToken",
  "AUTHORIZATION",
  "password",
  "Password",
  "passwd",
  "client_secret",
  "Cookie",
  "set-cookie",
  "credentials",
  "apiKey",
  "api_key",
  "api-key",
];

test("a property named like a secret is replaced whatever its value, and the others are kept", () => {
  const value = Object.fromEntries([
    ...secretNames.map((name) => [name, "hunter2"]),
    ["build", 100],
    ["versionName", "1.0.0"],
    ["enabled", true],
    ["missing", null],
  ]);

  const copy = inspectValue(value);

  expect(copy).toEqual({
    ...Object.fromEntries(secretNames.map((name) => [name, "[Redacted]"])),
    build: 100,
    versionName: "1.0.0",
    enabled: true,
    missing: null,
  });
  expect(JSON.stringify(copy)).not.toContain("hunter2");
});

test("a secret is replaced at any depth, in objects inside lists too, whatever it holds", () => {
  const copy = inspectValue({
    nested: { deeper: { token: "t", fine: 1, list: [{ cookie: "c", ok: 2 }] } },
    session: { password: { value: "still secret", parts: ["a", "b"] } },
  });

  expect(copy).toEqual({
    nested: {
      deeper: {
        token: "[Redacted]",
        fine: 1,
        list: [{ cookie: "[Redacted]", ok: 2 }],
      },
    },
    session: { password: "[Redacted]" },
  });
});

test("a getter, toJSON and a proxy trap never run while a value is copied", () => {
  const getter = vi.fn(() => "computed");
  const toJSON = vi.fn(() => "custom");
  const trap = vi.fn();

  const value = {
    toJSON,
    visible: 1,
    proxy: new Proxy(
      {},
      {
        get: trap,
        getPrototypeOf: () => Object.prototype,
        ownKeys: () => [],
      },
    ),
  };

  Object.defineProperty(value, "computed", { enumerable: true, get: getter });

  const copy = inspectValue(value);

  expect(copy).toEqual({
    toJSON: "[function]",
    visible: 1,
    proxy: {},
    computed: "[Accessor]",
  });
  expect(getter).not.toHaveBeenCalled();
  expect(toJSON).not.toHaveBeenCalled();
  expect(trap).not.toHaveBeenCalled();
});

test("a value that throws while it is read becomes a placeholder, never an error", () => {
  const hostile = new Proxy(
    {},
    {
      getPrototypeOf: () => {
        throw new Error("no prototype");
      },
    },
  );

  expect(inspectValue(hostile)).toBe("[Unable to inspect this value]");
  expect(inspectValue({ inner: hostile })).toBe(
    "[Unable to inspect this value]",
  );
});

test("an object that is not plain is named by its class and never walked", () => {
  class Registration {
    scope = "/";
    token = "not walked";
  }

  const copy = inspectValue({
    registration: new Registration(),
    element: document.body,
    date: new Date(0),
    map: new Map([["a", 1]]),
    error: new Error("boom"),
    bare: Object.create(Object.create(null)),
    module: Object.assign(Object.create(null), {
      reload: () => {},
      token: "x",
    }),
  });

  expect(copy).toEqual({
    registration: "[Registration]",
    element: "[HTMLBodyElement]",
    date: "[Date]",
    map: "[Map]",
    error: "[Error]",
    bare: "[object]",
    module: { reload: "[function]", token: "[Redacted]" },
  });
});

test("what a value cannot say in JSON is written out", () => {
  expect(
    inspectValue({
      big: 12n,
      symbol: Symbol("s"),
      fn: () => 1,
      undef: undefined,
      nan: Number.NaN,
      infinity: Number.POSITIVE_INFINITY,
      zero: 0,
      no: false,
    }),
  ).toEqual({
    big: "12n",
    symbol: "[symbol]",
    fn: "[function]",
    undef: "[undefined]",
    nan: "NaN",
    infinity: "Infinity",
    zero: 0,
    no: false,
  });
  expect(inspectValue(undefined)).toBe("[undefined]");
  expect(inspectValue(null)).toBeNull();
});

test("a cycle and a repeated reference are cut instead of followed", () => {
  const shared = { name: "shared" };
  const cycle: Record<string, unknown> = { shared, again: shared };

  cycle["self"] = cycle;

  expect(inspectValue(cycle)).toEqual({
    shared: { name: "shared" },
    again: "[Circular or repeated reference]",
    self: "[Circular or repeated reference]",
  });
});

test("a text, a list and an object are cut to their limits, and the cut says so", () => {
  const long = inspectValue("x".repeat(5_000));

  expect(typeof long === "string" && long.length).toBeLessThan(2_020);
  expect(String(long).endsWith("… [Truncated]")).toBe(true);
  expect(inspectValue("short")).toBe("short");

  const list = inspectValue(Array.from({ length: 5_000_000 }, () => 1));

  expect(Array.isArray(list) && list.length).toBe(51);
  expect(Array.isArray(list) && list.at(-1)).toBe("[Truncated]");

  const wide = inspectValue(
    Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [`k${index}`, index]),
    ),
  );

  if (typeof wide !== "object" || wide === null) {
    throw new Error("Expected an object.");
  }

  expect(Object.keys(wide)).toHaveLength(51);
  expect(Reflect.get(wide, "…")).toBe("[Truncated]");
});

test("a value nested deeper than the limit, or bigger than the budget, is cut", () => {
  let deep: Record<string, unknown> = { leaf: true };

  for (let level = 0; level < 20; level += 1) {
    deep = { next: deep };
  }

  const text = JSON.stringify(inspectValue(deep));

  expect(text).toContain("[Truncated]");
  expect(text).not.toContain("leaf");

  const many = inspectValue(
    Array.from({ length: 50 }, () =>
      Array.from({ length: 50 }, (_, index) => index),
    ),
  );

  expect(JSON.stringify(many)).toContain("[Truncated]");
  expect(JSON.stringify(many).length).toBeLessThan(3_000);
});

test("a property called __proto__ is data, not a prototype", () => {
  const copy = inspectValue(
    JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}'),
  );

  expect(Object.getPrototypeOf(copy)).toBeNull();
  expect(Reflect.get({}, "polluted")).toBeUndefined();
  expect(JSON.stringify(copy)).toBe('{"__proto__":{"polluted":true},"safe":1}');
});
