// Typechecked, never run: the declared routes decide what each route of a
// manifest can be read as, so a decision of the wrong kind or order does not
// compile.
import {
  createUpdateMechanism,
  newerRoute,
  targetRoute,
} from "@priemskiyyy/beacon";
import type { DecisionRevision, ReleaseScope } from "@priemskiyyy/beacon";
import { integer, semver } from "@priemskiyyy/beacon/versions";
import { expectTypeOf } from "vitest";

import { http } from "src/http";
import type { HttpAnswer } from "src/types/HttpAnswer";
import type { ManifestResponse } from "src/types/ManifestResponse";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardManifest } from "src/types/StandardManifest";
import type { StandardRead } from "src/types/StandardRead";
import { parseStandardManifest } from "src/parseStandardManifest";
import { readStandardManifest } from "src/readStandardManifest";

declare const scope: ReleaseScope;
declare const response: ManifestResponse;

const routes = {
  web: { kind: "target" },
  binary: { kind: "candidate", order: "text" },
  build: { kind: "candidate", order: "integer" },
} satisfies RouteDeclarations;

const inert = createUpdateMechanism({
  name: "inert",
  subject: "web",
  open: () => ({ native: {} }),
  commands: {},
});

const store = createUpdateMechanism({
  name: "store",
  subject: "native",
  open: () => ({ native: {} }),
  commands: {},
});

export const manifest = http({
  fetch: () => readStandardManifest({ response, scope, routes, now: 0 }),
});

export const web = targetRoute({
  source: manifest.select((document) => document.routes.web),
  mechanism: inert,
});

export const binary = newerRoute({
  source: manifest.select((document) => document.routes.binary),
  version: semver(),
  current: (release) => release?.label ?? null,
  mechanism: store,
});

export const build = newerRoute({
  source: manifest.select((document) => document.routes.build),
  version: integer(),
  current: () => 0,
  mechanism: store,
});

// The response of any `fetch` is what a manifest is read from.
expectTypeOf<Response>().toExtend<ManifestResponse>();

// A parse gives the evidence a source needs. The digest and the expiry are always there, and the revision only when the manifest numbers its decisions.
const read = parseStandardManifest({ text: "", scope, routes, now: 0 });

expectTypeOf(read).toEqualTypeOf<StandardRead<typeof routes>>();
expectTypeOf(read.digest).toBeString();
expectTypeOf(read.expiresAt).toBeNumber();
expectTypeOf(read.revision).toEqualTypeOf<DecisionRevision | undefined>();

// And it is an answer of `http` as it stands.
export const answer: HttpAnswer<StandardManifest<typeof routes>> = {
  status: "changed",
  ...read,
};

// The remediation route of the support facts is a route the application declared.
expectTypeOf(read.document.support).toEqualTypeOf<{
  revision: string;
  subject: "native" | "bundle" | "web" | "worker";
  deniedReleaseIds: string[];
  reasonCode: string;
  remediationRoute: "web" | "binary" | "build";
} | null>();

targetRoute({
  // @ts-expect-error -- a candidate route is not a target route.
  source: manifest.select((document) => document.routes.binary),
  mechanism: inert,
});

newerRoute({
  // @ts-expect-error -- a target route is not a candidate route.
  source: manifest.select((document) => document.routes.web),
  version: semver(),
  current: () => "1.0.0",
  mechanism: store,
});

newerRoute({
  // @ts-expect-error -- an integer order does not feed a semantic version strategy.
  source: manifest.select((document) => document.routes.build),
  version: semver(),
  current: () => "1.0.0",
  mechanism: store,
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
  // @ts-expect-error -- the domain of the ids a route names is a text.
  routes: { web: { kind: "target", domain: 7 } },
  now: 0,
});

// A route may spell the domain of its ids, which a text identity then names.
export const binaries = parseStandardManifest({
  text: "",
  scope,
  routes: {
    binary: { kind: "candidate", order: "integer", domain: "ios-build" },
  },
  now: 0,
});

parseStandardManifest({
  text: "",
  scope,
  routes,
  // @ts-expect-error -- the local time is epoch milliseconds, not a date.
  now: new Date(),
});
