// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that the forced-upgrade policy does not check it again at runtime.
import { expectTypeOf } from "vitest";

import type { SupportPolicy } from "src/types/SupportPolicy";
import { Beacon } from "src/utils/Beacon";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createReleaseSource } from "src/utils/createReleaseSource";
import { minimumBuild } from "src/utils/minimumBuild";

type Config = { minimumBuild: string | number; minimumVersion: boolean };

const config = createReleaseSource<Config>({
  name: "config",
  read: async () => {
    throw new Error("Never run.");
  },
});

const store = createReleaseDriver({
  name: "store",
  subject: "native",
  prepares: false,
  open: () => ({
    native: {},
    check: async () => ({
      status: "none",
      reason: "no-decision",
      detail: null,
    }),
  }),
  commands: {},
});

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "ios",
  distribution: "app-store",
};

// The route it sends an older build to is a route of the Beacon, and is inferred from the name.
export const named = minimumBuild({
  source: config.select((document) => document.minimumBuild),
  remediation: "store",
  level: "recommended",
});

expectTypeOf(named).toEqualTypeOf<SupportPolicy<Config, string, "store">>();

export const beacon = new Beacon({
  scope,
  routes: { store },
  policy: named,
});

export const bare = minimumBuild({
  source: config.select((document) => document.minimumBuild),
});

// Without a remediation the policy names no route, so it fits a Beacon of any routes.
expectTypeOf(bare).toEqualTypeOf<SupportPolicy<Config, string, never>>();

export const lonely = new Beacon({ scope, routes: { store }, policy: bare });

// Written inline, with no route to name, it still fits: what the Beacon's own routes are is not a guess for it to make.
export const inline = new Beacon({
  scope,
  routes: { store },
  policy: minimumBuild({
    source: config.select((document) => document.minimumBuild),
  }),
});

export const ghost = new Beacon({
  scope,
  routes: { store },
  // @ts-expect-error A policy cannot name a route this Beacon does not have.
  policy: minimumBuild({
    source: config.select((document) => document.minimumBuild),
    remediation: "ghost",
  }),
});

// @ts-expect-error A level belongs to a remediation, and there is none to give it to.
minimumBuild({
  source: config.select((document) => document.minimumBuild),
  level: "required",
});

minimumBuild({
  source: config.select((document) => document.minimumBuild),
  remediation: "store",
  // @ts-expect-error A minimum build is required or recommended, never an alternative.
  level: "alternative",
});

minimumBuild({
  // @ts-expect-error The minimum is text or a number, and never a flag.
  source: config.select((document) => document.minimumVersion),
});
