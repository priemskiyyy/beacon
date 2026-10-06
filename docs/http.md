---
description: "Read your release manifest from a URL with standardManifestSource, in the small form a static host can serve or the full one a release service can sign, or make your own client a Beacon release source with http."
---

# HTTP

`@priemskiyyy/beacon-http` makes a release manifest a [source](routes.md#sources). `standardManifestSource` asks for a manifest at a URL and reads it, so a manifest in a file next to your app is one call. `http` is the door for your own client, which owns the transport, authentication, retries and validation.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-http
```

## A manifest at a URL

```ts
import { targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { standardManifestSource } from "@priemskiyyy/beacon-http";

const manifest = standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
});

export const web = targetRoute({
  source: manifest.select((document) => document.routes.web),
  mechanism: browserReload(),
});
```

`routes` declares which routes you read and what each is. The file is what your build writes next to the app, with the id of the build it just shipped:

```json
{
  "schemaVersion": 1,
  "routes": {
    "web": { "kind": "target", "release": { "identity": "a91b44e" } }
  }
}
```

`identity` written as a text is a build of this application: it is known, under `scope.application` as its authority and the domain `web-artifact` of a [`target` route](browser.md#what-the-running-fact-must-say), so it is comparable with what `webBuild` reports. A `{ "kind": "none", "reason": "up-to-date" }` in place of the decision says nothing is to be offered. Nothing else is required of a static host.

The source asks the global `fetch` for the URL with `cache: "no-cache"`, sends the `ETag` of the answer it holds back as `If-None-Match`, reads the time from the Beacon's clock, passes the scope, and refuses everything that is not a valid manifest for it: a login page, an error status, a redirect, a file for another scope. A failed read never becomes "no release", and what was accepted stays.

| Option    | Meaning                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `url`     | where the manifest is served                                                                                       |
| `routes`  | the routes you read, each `{ kind: "target" }` or `{ kind: "candidate", order }`, and the `domain` of its ids      |
| `fetch`   | the client that makes the request, the global `fetch` by default: your own for a test, a login or a platform quirk |
| `headers` | sent with every request, such as an authorization header. The validator is sent by the source                      |
| `name`    | the source's name in diagnostics and evidence, `manifest` by default                                               |
| `limits`  | the bounds of a manifest: see [limits](#limits)                                                                    |

A host without a global `fetch` fails the read and says to pass one.

### Serve it so that it is fresh

A manifest that a cache serves late is an offer that is no longer true, so the freshness of the file is yours to set:

- Serve it as `application/json`, which a static host does for a `.json` file, and with `Cache-Control: no-cache`, which lets a cache store it and makes it ask the server before it answers, or `max-age=0, must-revalidate`. The source's own `cache: "no-cache"` asks the browser to do exactly that, and it does not reach a CDN or a proxy between you and the browser.
- Serve an `ETag`, which most static hosts do by default. The next read sends it back, and a `304` answers without a body.
- A service worker that precaches the manifest serves the file it stored. Keep the manifest out of the precache, or it reports the build that was current when the worker installed.
- Put it on the origin of the app, or an origin you control. A redirect is refused.

### What the evidence says when the file has no times

A manifest that gives no `expiresAt` claims no expiry of its own, so Beacon holds what it read for its own window, the `lifetime` limit of 24 hours, counted from the read on the Beacon's clock. That is the client's claim and not the authority's: nobody said the answer is good for a day. Every read that the server confirms, a `304` or a fresh `200`, starts the window again, so an app that keeps checking keeps fresh evidence, and one that stops sees it go stale by time alone.

Without a `decisionRevision` Beacon has no number to tell an older copy from a newer one. A cache that serves the file of an earlier deploy after a later one is believed until the next read, so the freshness headers above and the window are all that bound it. A manifest that numbers its decisions has the core reject a regression.

### When your release service can write more

The schema has four more fields, each optional and judged whenever it is there:

| Field                                                    | What it adds                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `issuedAt`, `expiresAt`                                  | the authority's own time: a copy past `expiresAt` is refused, and one that lives longer than the lifetime limit is refused |
| `decisionRevision`                                       | an older copy served late is rejected as a regression, and the same decision under another digest as a conflict            |
| `application`, `environment`, `platform`, `distribution` | the scope the file speaks for, which is refused whole if it differs from the Beacon's                                      |

A release's `identity` is either the text above or the long form `{ "status": "known", "authority", "domain", "value" }`, which names the authority and domain itself.

## Your own client

`http({ name, fetch })` answers a source. `fetch` runs once for each read, and what it resolves is trusted as typed.

```ts
import { http } from "@priemskiyyy/beacon-http";
import type { HttpAnswer } from "@priemskiyyy/beacon-http";
import type { NoneDecision, TargetDecision } from "@priemskiyyy/beacon";

type Releases = { web: TargetDecision | NoneDecision };

// Your validator, with the schema library you already use.
declare const parseReleases: (input: unknown) => Releases;

export const manifest = http({
  name: "release-manifest",
  fetch: async ({ signal, validator }): Promise<HttpAnswer<Releases>> => {
    const response = await fetch("/releases.json", {
      signal,
      headers: validator === null ? {} : { "if-none-match": validator },
    });

    if (response.status === 304) {
      return { status: "not-modified" };
    }

    const etag = response.headers.get("etag");

    return {
      document: parseReleases(await response.json()),
      ...(etag === null ? {} : { validator: etag }),
    };
  },
});
```

`fetch` receives the `scope`, an abort `signal`, the `attempt` number, the Beacon's `clock` and the `validator` of the answer this source holds for that scope, or `null`. Validate the response in your client before you answer: Beacon trusts the types. A thrown `BeaconError` keeps its code, and any other error fails the read with `SOURCE_FAILED` and keeps the original as `cause`. `http` makes no request of its own.

### The answer

| Status                     | Meaning                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| a `document`, or `changed` | the validated `document`, its `validator` for the next read, and the evidence Beacon judges it by: `revision`, `digest`, `issuer`, `expiresAt` |
| `not-modified`             | the document this source holds is still the authority's answer. It renews that document; with a new `expiresAt` it also moves the expiry       |

An answer with a `document` is a changed answer, so you do not write the status. A `not-modified` without an `expiresAt` keeps the old expiry, so an answer is never fresher than the backend said. A `not-modified` when the source holds nothing to renew, such as after the scope changed, fails the read with `SOURCE_FAILED`. It never invents a document. An answer of any other status, which a client without types can still give, fails the read the same way and renews nothing.

The source remembers the last answer it accepted, only for the scope it was read for. The `validator` you receive is the one of that scope, so a validator or a document never crosses from one account to another. See [scopes](scopes.md#partitions).

### Advanced: a window of the client's own

An answer that claims no expiry of its own, which is what a standard manifest without an `expiresAt` is, holds for a window the client sets. Say so with `holdsFor`, the milliseconds the window lasts, next to an `expiresAt` that counts it once from now: a later `not-modified` then counts it again from the moment the backend confirmed the document, instead of keeping an expiry that has already passed. `standardManifestSource` and `readStandardManifest` do this for you, with `limits.lifetime` as the window. An answer with an `expiresAt` the backend claimed is never given a `holdsFor`: a confirmation cannot make it fresher than the authority said.

```ts
import { http } from "@priemskiyyy/beacon-http";

export const versionFile = http<{ build: string }>({
  fetch: async ({ signal, validator, clock }) => {
    const response = await fetch("/version.json", {
      signal,
      headers: validator === null ? {} : { "if-none-match": validator },
    });

    if (response.status === 304) {
      return { status: "not-modified" };
    }

    const etag = response.headers.get("etag");

    return {
      document: await response.json(),
      expiresAt: clock.now() + 600_000,
      holdsFor: 600_000,
      ...(etag === null ? {} : { validator: etag }),
    };
  },
});
```

## The standard manifest

A small, optional schema for a manifest that one application, environment, platform and distribution serves. You need not use it: any client that answers a validated document works with `http()`. `standardManifestSource` reads it from a URL. Where the request is yours, `readStandardManifest` turns the response of your `fetch` into the answer and rejects everything that is not a valid manifest:

```ts
import { targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

const routes = {
  web: { kind: "target" },
  binary: {
    kind: "candidate",
    order: "integer",
    domain: "android-version-code",
  },
} satisfies RouteDeclarations;

const manifest = http({
  name: "release-manifest",
  fetch: async ({ scope, signal, validator, clock }) =>
    readStandardManifest({
      response: await fetch("/releases.json", {
        signal,
        headers: validator === null ? {} : { "if-none-match": validator },
      }),
      scope,
      routes,
      now: clock.now(),
    }),
});

export const web = targetRoute({
  source: manifest.select((document) => document.routes.web),
  mechanism: browserReload(),
});

export const support = manifest.select((document) => document.support);
```

`routes` declares which routes you read and what each is. The types follow the declaration:

- A `target` route reads a target or a none decision.
- A `candidate` route reads a candidate or a none decision, whose `order` is `text` or `integer`. Use `text` with a strategy that parses a string, such as `semver()`, and `integer` with `integer()`.
- The manifest cannot switch a route to the other kind. A decision of the wrong kind is `INVALID_DOCUMENT`.
- `domain` is what the ids of the route name, for a release whose `identity` is written as a text. A `target` route names `web-artifact` unless it declares another. A `candidate` route has no default, since nothing says whether it is a binary or a bundle: spell it, such as `android-version-code` or `ios-build`, or write the long form of the identity.

The document has one decision for each declared route, and the optional `support` facts.

### The manifest

```json
{
  "schemaVersion": 1,
  "application": "com.example.notes",
  "environment": "production",
  "platform": "web",
  "distribution": "public-web",
  "decisionRevision": {
    "kind": "ordered",
    "domain": "notes-web-deployments",
    "epoch": "production-v1",
    "value": "208"
  },
  "issuedAt": "2026-09-27T10:00:00Z",
  "expiresAt": "2026-09-27T10:10:00Z",
  "routes": {
    "web": {
      "kind": "target",
      "release": {
        "identity": {
          "status": "known",
          "authority": "com.example.notes",
          "domain": "web-artifact",
          "value": "web-build-a"
        },
        "label": "September recovery release",
        "metadata": { "releaseNotesKey": "recovery-208" }
      }
    },
    "binary": {
      "kind": "candidate",
      "release": {
        "identity": "112",
        "label": "2.5.0",
        "order": 112
      }
    }
  },
  "support": {
    "revision": "policy-43",
    "subject": "web",
    "deniedReleaseIds": ["web-build-b"],
    "reasonCode": "known-regression",
    "remediationRoute": "web"
  }
}
```

| Field                                                    | Rule                                                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                                          | required, and must be `1`                                                                                                                                                                             |
| `application`, `environment`, `platform`, `distribution` | optional; each one present must repeat the scope exactly. A manifest never states a `partition`                                                                                                       |
| `decisionRevision`                                       | optional: `{ kind: "opaque", value }`, or `{ kind: "ordered", domain, epoch, value }` with a `value` that Beacon requires to be a canonical decimal                                                   |
| `issuedAt`, `expiresAt`                                  | optional UTC timestamps such as `2026-09-27T10:00:00Z`, with an optional fraction of up to three digits. Without an `expiresAt`, see [the window](#what-the-evidence-says-when-the-file-has-no-times) |
| `routes`                                                 | required: one decision for each declared route: `target`, `candidate` or `none`                                                                                                                       |
| `support`                                                | optional: `revision`, `subject`, `deniedReleaseIds`, `reasonCode` and `remediationRoute`, which must be a declared route                                                                              |

A decision is `{ kind: "target", release }`, `{ kind: "candidate", release }` where the release carries `order`, or `{ kind: "none", reason }`. A release has an `identity` and optionally a `label`, a `compatibility` and `metadata`. An `identity` is a text, which the route's domain names, or `{ status: "known", authority, domain, value }`, or `{ status: "unknown", reason }`. A compatibility is `compatible` with a `basis`, `incompatible` with `reasons`, `delegated` with an `authority`, `unknown` with a `reason`, or `not-applicable`.

Every text is 1 to 256 characters, a list has at most 256 items, and `metadata` has at most 16 entries of short strings. A key that could corrupt a registry (`__proto__`, `constructor`, `prototype`) is refused.

The release's identity has to be named the way the page or the binary names what it runs, or the route says `inconclusive`. `webBuild` of `@priemskiyyy/beacon-browser` reads the running web build under the domain `web-artifact`, and `expoApplication` of `@priemskiyyy/beacon-expo` and `deviceInfo` of `@priemskiyyy/beacon-device-info` read the installed binary under `android-version-code` and `ios-build`, each under the application of the scope as authority: see [browser](browser.md#what-the-running-fact-must-say) and [the installed binary](expo.md#the-installed-binary).

### What is accepted

The whole manifest or none of it. `standardManifestSource`, `readStandardManifest` (the response) and `parseStandardManifest` (the text) throw a `BeaconError` that says which rule broke, and a source that throws keeps the last document it accepted.

| Outcome                                                                                                                                 | Result                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `200` with a JSON body                                                                                                                  | parsed                                                         |
| `304`                                                                                                                                   | `not-modified`, which renews what the source holds             |
| `204`, `404`, `401`, `403`, `429`, a server error, any other status                                                                     | `SOURCE_FAILED`, never "no release"                            |
| A redirected response                                                                                                                   | `SOURCE_FAILED`: use a same-origin endpoint                    |
| A response that is not served as JSON, such as a login page (its `Content-Type` is not `application/json` or `+json`), or an empty body | `INVALID_DOCUMENT`                                             |
| A body over the size limit                                                                                                              | `INVALID_DOCUMENT`; an over-limit `Content-Length` is not read |
| An unknown `schemaVersion`, another scope, a route missing, or a decision of the wrong kind                                             | `INVALID_DOCUMENT`                                             |
| A date that does not exist, a lifetime over the limit, a future issue, or an expired manifest                                           | `INVALID_DOCUMENT`                                             |

The `ETag` is the validator for the next read and never the revision. A field the schema does not name is ignored and never reaches the document. A repeated JSON key keeps its last value, because the text is decoded as JSON. A byte order mark in front of the text, which a file saved by a Windows tool starts with and a React Native fetch hands over as it is, is not part of the document.

### Redirects on React Native

A redirect is refused only where the response says it was one. `response.redirected` is there in browsers, in Node and in `expo/fetch`, which is the global `fetch` of an Expo SDK 57 app unless `EXPO_PUBLIC_USE_RN_FETCH` is set. React Native's own `fetch` is `whatwg-fetch` over the native network stack: the stack follows a redirect and the response has no `redirected`, so this reader cannot refuse one and accepts the manifest that comes back. The manifest still has to name your scope and pass every other rule. Where you want the refusal, make it in the `fetch` you pass: React Native's source gives the response the URL of the last request on both platforms, so compare it with the endpoint. The native stacks may write a URL in a normal form, so name the endpoint in its normal form, with a lowercase host and no default port. No device has run this.

```ts
import { standardManifestSource } from "@priemskiyyy/beacon-http";

const RELEASES_URL = "https://updates.example.com/releases.json";

export const manifest = standardManifestSource({
  url: RELEASES_URL,
  routes: { web: { kind: "target" } },
  fetch: async (url, init) => {
    // The `cache` option is left out: React Native's own fetch turns it into a `_` parameter of the URL, which would look like a redirect.
    const response = await fetch(url, {
      signal: init.signal,
      headers: init.headers,
    });

    return {
      status: response.status,
      // A response that came from another URL than the one asked for was redirected.
      redirected: response.url !== url,
      headers: response.headers,
      text: () => response.text(),
    };
  },
});
```

Ask for the exact URL you serve: a server that rewrites it, such as by adding a trailing slash, looks like a redirect and fails the read.

### Evidence

A valid manifest becomes a read with its evidence: the `revision` when the manifest numbers its decisions, a `digest` of the routes' decisions without their renewable times, and the narrowest `expiresAt`. The support facts carry a revision of their own, so a policy update under the same decision is a renewal, not a conflict.

The evidence expires at the narrowest of the manifest's `expiresAt` and `now + lifetime`, where `now` is the Beacon's clock when the response was read. A copy that a service worker or a cache served late is never fresher than the authority said, and a manifest that has already expired is refused. A `fetch` cache option does not bypass a service worker or an intermediary, and this reader does not claim it does.

### Limits

`limits` tunes what a document may be. The defaults are documented values, not universal ideals.

| Limit      | Default    | Meaning                                                                                                        |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `bytes`    | 262,144    | the most bytes of a decoded document                                                                           |
| `lifetime` | 86,400,000 | the most milliseconds between `issuedAt` and `expiresAt`, and the window of a manifest that has no `expiresAt` |
| `skew`     | 300,000    | the most milliseconds a manifest may be issued ahead of your clock                                             |

A runtime that cannot stream, such as React Native's `fetch`, reads the text whole. A response that declares a `Content-Length` over the limit is refused without reading the body, and the size of every text is checked when it is parsed. Bound the transfer in your own `fetch` to stop a hostile stream early.

### Parsing text

`parseStandardManifest` takes the text you already hold, for example from a cache, together with the local time in epoch milliseconds.

```ts
import { parseStandardManifest } from "@priemskiyyy/beacon-http";

const read = parseStandardManifest({
  text: '{"schemaVersion":1}',
  scope,
  routes: { web: { kind: "target" } },
  now: Date.now(),
});

console.info(read.revision, read.digest, read.expiresAt);
```

The example text is not a manifest, so this call throws `INVALID_DOCUMENT` at run time. Answer `{ status: "changed", ...read }` from `fetch` when it succeeds.

## Not included

- Signed manifests. Verification of canonical bytes is independent of parsing and needs a signing scheme this package does not invent.
- Duplicate-key rejection. The decoder policy is JSON's: the last key wins, and the decoded document is validated as a whole.
- A retry policy. `429` fails the read. `Retry-After` and scheduling belong to the application.
