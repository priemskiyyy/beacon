import { webcrypto } from "node:crypto";

import { afterEach, expect, test, vi } from "vitest";

import { createBootId } from "src/utils/createBootId";

const VERSION_4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const COUNT = 2_000;

// The host's own source, kept apart from the global a Hermes-like run removes.
const host = webcrypto;

afterEach(() => {
  vi.unstubAllGlobals();
});

const createMany = () => Array.from({ length: COUNT }, createBootId);

const expectUniqueVersion4 = (ids: string[]) => {
  expect(new Set(ids).size).toBe(COUNT);
  expect(ids.every((id) => id.length === 36 && VERSION_4.test(id))).toBe(true);
};

const fillFrom = (next: () => number) => (bytes: Uint8Array) => {
  for (const index of bytes.keys()) {
    bytes[index] = next();
  }

  return bytes;
};

const hostBytes = (bytes: Uint8Array) => host.getRandomValues(bytes);

const refuse = () => {
  throw new Error("The host refuses to give random values.");
};

test("an id is made without reading the host clock", () => {
  const now = vi.spyOn(Date, "now");
  const performanceNow = vi.spyOn(performance, "now");

  vi.stubGlobal("crypto", undefined);
  createMany();
  vi.unstubAllGlobals();
  createMany();

  expect(now).not.toHaveBeenCalled();
  expect(performanceNow).not.toHaveBeenCalled();
});

test("a host with crypto.randomUUID is asked for the id, and no other source is used", () => {
  const random = vi.spyOn(Math, "random");

  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
    getRandomValues: refuse,
  });

  expect(createBootId()).toBe("11111111-2222-4333-8444-555555555555");
  expect(random).not.toHaveBeenCalled();
});

test("an id is a version 4 UUID and no two are alike, from the host's own randomUUID", () => {
  expectUniqueVersion4(createMany());
});

test("crypto.getRandomValues, where randomUUID is missing, makes a version 4 UUID, and no two are alike", () => {
  const random = vi.spyOn(Math, "random");

  vi.stubGlobal("crypto", { getRandomValues: hostBytes });

  expectUniqueVersion4(createMany());
  expect(random).not.toHaveBeenCalled();
});

test.each([
  ["Hermes, which has no crypto", undefined],
  ["an insecure page, whose crypto has no random source", {}],
  ["a crypto whose random values are refused", { getRandomValues: refuse }],
  [
    "a crypto whose randomUUID is refused",
    { randomUUID: refuse, getRandomValues: hostBytes },
  ],
  [
    "a polyfill that has nothing callable",
    { randomUUID: 1, getRandomValues: "" },
  ],
])(
  "%s still makes a version 4 UUID from Math.random, and no two are alike",
  (_name, source) => {
    vi.stubGlobal("crypto", source);

    expectUniqueVersion4(createMany());
  },
);

test("the version and the variant are set, whatever the random bytes are", () => {
  vi.stubGlobal("crypto", { getRandomValues: fillFrom(() => 255) });

  expect(createBootId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");

  vi.stubGlobal("crypto", { getRandomValues: fillFrom(() => 0) });

  expect(createBootId()).toBe("00000000-0000-4000-8000-000000000000");

  vi.stubGlobal("crypto", undefined);

  const random = vi.spyOn(Math, "random");

  random.mockReturnValue(0.999999);
  expect(createBootId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");

  random.mockReturnValue(0);
  expect(createBootId()).toBe("00000000-0000-4000-8000-000000000000");
});

test("an id made from Math.random asks it for sixteen bytes", () => {
  const random = vi.spyOn(Math, "random");

  vi.stubGlobal("crypto", undefined);
  createBootId();

  expect(random).toHaveBeenCalledTimes(16);
});
