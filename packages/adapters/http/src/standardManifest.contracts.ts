// Typechecked, never run: the declared routes decide what each route of a
// manifest can be read as, so a decision of the wrong kind or order does not
// compile.
import {
  createUpdateMechanism,
  newerRoute,
  targetRoute,
} from "@priemskiyyy/beacon";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { integer, semver } from "@priemskiyyy/beacon/versions";
import { expectTypeOf } from "vitest";

import { http } from "src/http";
import type { ManifestResponse } from "src/types/ManifestResponse";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardRead } from "src/types/StandardRead";
import { parseStandardManifest } from "src/utils/parseStandardManifest";
import { readStandardManifest } from "src/utils/readStandardManifest";

declare const scope: ReleaseScope;
declare const response: ManifestResponse;

const routes = {
  web: { kind: "target" },
  binary: { kind: "candidate", order: "text" },
  build: { kind: "candidate", order: "integer" },
} satisfies RouteDeclarations;

const inert = createUpdateMechanism({
  name: "inert",
  open: () => ({ native: {} }),
  commands: {},
});

export const manifest = http({
  fetch: () => readStandardManifest({ response, scope, routes, now: 0 }),
});

export const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.routes.web),
  mechanism: inert,
});

export const binary = newerRoute({
  subject: "native",
  source: manifest.select((document) => document.routes.binary),
  version: semver(),
  current: (release) => release?.label ?? null,
  mechanism: inert,
});

export const build = newerRoute({
  subject: "native",
  source: manifest.select((document) => document.routes.build),
  version: integer(),
  current: () => 0,
  mechanism: inert,
});

// A parse gives the evidence a source needs, all of it present.
const read = parseStandardManifest({ text: "", scope, routes, now: 0 });

expectTypeOf(read).toEqualTypeOf<StandardRead<typeof routes>>();
expectTypeOf(read.digest).toBeString();
expectTypeOf(read.expiresAt).toBeNumber();

// The remediation route of the support facts is a route the application declared.
expectTypeOf(read.document.support).toEqualTypeOf<{
  revision: string;
  subject: "native" | "bundle" | "web" | "worker";
  deniedReleaseIds: string[];
  reasonCode: string;
  remediationRoute: "web" | "binary" | "build";
} | null>();

targetRoute({
  subject: "native",
  // @ts-expect-error -- a candidate route is not a target route.
  source: manifest.select((document) => document.routes.binary),
  mechanism: inert,
});

newerRoute({
  subject: "web",
  // @ts-expect-error -- a target route is not a candidate route.
  source: manifest.select((document) => document.routes.web),
  version: semver(),
  current: () => "1.0.0",
  mechanism: inert,
});

newerRoute({
  subject: "native",
  // @ts-expect-error -- an integer order does not feed a semantic version strategy.
  source: manifest.select((document) => document.routes.build),
  version: semver(),
  current: () => "1.0.0",
  mechanism: inert,
});

// @ts-expect-error -- a route the application did not declare is not in the document.
manifest.select((document) => document.routes.elsewhere);

parseStandardManifest({
  text: "",
  scope,
  // @ts-expect-error -- a route is a target or a candidate.
  routes: { web: { kind: "install" } },
  now: 0,
});

parseStandardManifest({
  text: "",
  scope,
  // @ts-expect-error -- a candidate route declares the kind of its order.
  routes: { web: { kind: "candidate" } },
  now: 0,
});

parseStandardManifest({
  text: "",
  scope,
  routes,
  // @ts-expect-error -- the local time is epoch milliseconds, not a date.
  now: new Date(),
});
