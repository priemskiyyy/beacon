// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that the running facts and their readers are not checked again at runtime.
import { expectTypeOf } from "vitest";

import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningReaders } from "src/types/RunningReaders";
import type { RunningRelease } from "src/types/RunningRelease";
import type { RunningSubject } from "src/types/RunningSubject";

declare const release: RunningRelease;

// Every subject has a fact, and a reader may be given for any of them, so a new subject is added in one place.
expectTypeOf<keyof RunningApplication>().toEqualTypeOf<
  "boot" | "revision" | RunningSubject
>();

expectTypeOf<keyof RunningReaders>().toEqualTypeOf<"boot" | RunningSubject>();

export const readers: RunningReaders = {
  boot: { id: "boot-1" },
  web: () => release,
  worker: async () => release,
};

export const unread: RunningReaders = { boot: { id: "boot-1" } };

export const typo: RunningReaders = {
  boot: { id: "boot-1" },
  // @ts-expect-error A reader belongs to one of the subjects that can be running.
  webb: () => release,
};

// @ts-expect-error A boot names the runtime that executes, so it is required.
export const anonymous: RunningReaders = { web: () => release };
