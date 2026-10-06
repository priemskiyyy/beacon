// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that the running facts and their readers are not checked again at runtime.
import { expectTypeOf } from "vitest";

import type { BeaconOptions } from "src/types/BeaconOptions";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningReader } from "src/types/RunningReader";
import type { RunningReaderContext } from "src/types/RunningReaderContext";
import type { RunningReaders } from "src/types/RunningReaders";
import type { RunningRelease } from "src/types/RunningRelease";
import type { RunningSubject } from "src/types/RunningSubject";

declare const release: RunningRelease;

declare const scope: ReleaseScope;

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

// The boot id is the realm's unless one is given, so a Beacon needs no `running` at all.
export const anonymous: RunningReaders = { web: () => release };

export const options: BeaconOptions<Record<never, never>> = {
  scope,
  routes: {},
};

// A reader is given the scope of the read, and one that needs none leaves the parameter out.
export const scoped: RunningReaders = {
  web: ({ scope: read }) => ({
    identity: {
      status: "known",
      authority: read.application,
      domain: "web-artifact",
      value: read.environment,
    },
    label: null,
    raw: {},
  }),
};

expectTypeOf<RunningReaderContext>().toEqualTypeOf<{ scope: ReleaseScope }>();

export const named: RunningReaders = {
  // @ts-expect-error A reader is given a context with a scope, not the scope itself.
  web: (context: ReleaseScope) => ({
    identity: {
      status: "known",
      authority: context.application,
      domain: "web-artifact",
      value: "build-a",
    },
    label: null,
    raw: {},
  }),
};

export const invented: RunningReaders = {
  // @ts-expect-error A reader is given the scope and nothing else.
  web: ({ environment }: { environment: string }) => ({
    identity: { status: "unknown", reason: environment },
    label: null,
    raw: {},
  }),
};

declare const webReader: RunningReader<"web">;

declare const bundleReader: RunningReader<"bundle">;

// A reader made for a subject fits that subject, and a function of your own fits any.
export const branded: RunningReaders = {
  web: webReader,
  bundle: bundleReader,
  native: () => release,
};

export const swapped: RunningReaders = {
  // @ts-expect-error A reader made for the bundle is not the reader of the web build.
  web: bundleReader,
};

export const moved: RunningReaders = {
  // @ts-expect-error A reader made for the web build is not the reader of the bundle.
  bundle: webReader,
};

declare const plain: RunningReader;

// A reader of no particular subject fits every slot, and a branded one is a reader of any subject where the subject is not asked for.
export const unbranded: RunningReaders = { web: plain, bundle: plain };

export const anySubject: RunningReader<RunningSubject> = webReader;
