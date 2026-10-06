# @priemskiyyy/beacon-http

Your release manifest as a [Beacon](../../core) release source. `standardManifestSource` asks for a manifest at a URL and reads it, so a file next to your app is one call, and `http` is the door for your own client, which owns the transport, authentication, retries and response validation.

## Installation

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

const web = targetRoute({
  source: manifest.select((document) => document.routes.web),
  mechanism: browserReload(),
});
```

The file is what your build writes next to the app, and a static host can serve it as it is:

```json
{
  "schemaVersion": 1,
  "routes": {
    "web": { "kind": "target", "release": { "identity": "a91b44e" } }
  }
}
```

An `identity` written as a text is a build of this application: known, under `scope.application` and the domain `web-artifact` of a `target` route, which is what `webBuild` reads. The source asks the global `fetch` with `cache: "no-cache"`, sends the `ETag` back as `If-None-Match`, reads the time from the Beacon's clock, and refuses what is not a valid manifest for the scope: a login page, an error status, a redirect, another scope's file. Serve the file with `Cache-Control: no-cache`, and keep it out of a service worker's precache.

A manifest that gives no `expiresAt` claims no expiry of its own, so the evidence holds for the client's window, 24 hours from the read on the Beacon's clock, and every read the server confirms starts it again. Without a `decisionRevision` an older copy cannot be told from a newer one, so the freshness headers and the window are all that bound it.

`issuedAt`, `expiresAt`, `decisionRevision` and the echo of the scope (`application`, `environment`, `platform`, `distribution`) are optional, and judged whenever they are there. A release service that can write them gets a refusal of a stale copy, a regression and another scope's file.

## Your own client

```ts
import { http } from "@priemskiyyy/beacon-http";

const manifest = http({
  name: "release-manifest",
  fetch: async ({ signal, validator }) => {
    const response = await fetch("/releases.json", {
      signal,
      headers: validator === null ? {} : { "if-none-match": validator },
    });

    if (response.status === 304) {
      return { status: "not-modified" };
    }

    const etag = response.headers.get("etag");

    return {
      document: parseManifest(await response.json()), // your validator
      ...(etag === null ? {} : { validator: etag }),
    };
  },
});
```

`fetch` receives the scope, an abort signal, the attempt number, the Beacon's clock and the validator of the answer this source holds. Validate the response in your client, with the schema library you already use, before you answer: Beacon trusts the types. An answer with a `document` is a changed answer, so the status is written only for `not-modified`. A thrown `BeaconError` keeps its code, and any other error fails the read with `SOURCE_FAILED` and keeps the original as `cause`. `http` makes no request of its own.

## The answer

| Status                     | Meaning                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| a `document`, or `changed` | the validated `document`, its `validator` for the next read, and the evidence Beacon judges it by: `revision`, `digest`, `issuer`, `expiresAt` |
| `not-modified`             | the document this source holds is still the authority's answer. It renews that document; with a new `expiresAt` it also moves the expiry       |

A `not-modified` without an `expiresAt` keeps the old expiry, so an answer is never fresher than the backend said, unless the answer it renews says it `holdsFor` a window, which the standard manifest without an `expiresAt` does. A `not-modified` when this source holds nothing to renew, such as after the scope changed, fails the read: it never invents a document. An answer of any other status, which a client without types can still give, fails the read too and renews nothing.

## Partitions

When the answers differ by account, name the account in the scope, as opaque text:

```ts
beacon.replaceScope({ ...scope, partition: session.userId });
```

The source keeps and renews an answer only for the scope it was read for, so a validator or a document never crosses from one account to another, and the core forgets what the last account taught. The partition is never sent to your client except as part of the scope: it is not a place for a token.

## The standard manifest

A small schema for a manifest that one application, environment, platform and distribution serves. `routes` declares which routes you read and what each is. The types follow the declaration: a `target` route reads a target or a none decision, a `candidate` route reads a candidate or a none decision whose `order` is `text` or `integer`, and the manifest cannot switch a route to the other kind. A route's `domain` is what the ids of a text identity name: `web-artifact` for a `target` route unless it declares another, and spelled for a `candidate` route, such as `android-version-code` or `ios-build`. The document has one decision for each declared route and the optional `support` facts, whose `remediationRoute` is one of your routes.

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
        "identity": {
          "status": "known",
          "authority": "com.example.notes",
          "domain": "ios-build",
          "value": "412"
        },
        "label": "2.5.0",
        "order": "2.5.0"
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

The release's identity has to be named the way the page or the binary names what it runs, or the route says `inconclusive`. `webBuild` of [`@priemskiyyy/beacon-browser`](../browser) reads the running web build under the domain `web-artifact`, and `expoApplication` of [`@priemskiyyy/beacon-expo`](../expo) and `deviceInfo` of [`@priemskiyyy/beacon-device-info`](../device-info) read the installed binary under `android-version-code` and `ios-build`, each under the application of the scope as authority.

### What is accepted

The whole manifest or none of it. `parseStandardManifest` (the text), `readStandardManifest` (the response) and `standardManifestSource` throw a `BeaconError` that says which rule broke, and a source that throws keeps the last document it accepted.

| Outcome                                                                                       | Result                                                         |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `200` with a JSON body                                                                        | parsed                                                         |
| `304`                                                                                         | `not-modified`, which renews what the source holds             |
| `204`, `404`, `401`, `403`, `429`, a server error, any other status                           | `SOURCE_FAILED`, never "no release"                            |
| A redirected response                                                                         | `SOURCE_FAILED`: use a same-origin endpoint                    |
| A body that is not JSON, such as a login page, or is empty                                    | `INVALID_DOCUMENT`                                             |
| A body over the size limit                                                                    | `INVALID_DOCUMENT`; an over-limit `Content-Length` is not read |
| An unknown `schemaVersion`, another scope, a route missing, or a decision of the wrong kind   | `INVALID_DOCUMENT`                                             |
| A date that does not exist, a lifetime over the limit, a future issue, or an expired manifest | `INVALID_DOCUMENT`                                             |

The `ETag` is the validator for the next read and never the revision. A field the schema does not name is ignored and never reaches the document, a key that could corrupt a registry (`__proto__`, `constructor`, `prototype`) is refused as metadata, and a repeated JSON key keeps its last value because the text is decoded as JSON.

A redirect is told by `Response.redirected`. The `fetch` that ships with React Native does not set it, so there a redirect is not refused, unless your own `fetch` wrapper says it. React Native's `Response` does have `url`, the address that answered, so compare it with the one you asked for, in the `fetch` you give `standardManifestSource`; the documentation page has the wrapper. Ask for the exact URL you serve: a server that rewrites it, such as by adding a trailing slash, looks like a redirect and fails the read.

### Limits

`limits` tunes what a document may be, and the defaults are documented values, not universal ideals.

| Limit      | Default  | Meaning                                                                                                        |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `bytes`    | 262144   | the most bytes of a decoded document                                                                           |
| `lifetime` | 86400000 | the most milliseconds between `issuedAt` and `expiresAt`, and the window of a manifest that has no `expiresAt` |
| `skew`     | 300000   | the most milliseconds a manifest may be issued ahead of your clock                                             |

The evidence expires at the narrowest of the manifest's `expiresAt` and `now + lifetime`, so a copy that a service worker or a cache served late is never fresher than the authority said, and a manifest that has already expired is refused. A `fetch` cache option does not bypass a service worker or an intermediary, so this reader does not claim it does.

A runtime that cannot stream, such as React Native's `fetch`, reads the text whole. Stop a hostile stream early by bounding the transfer in your own `fetch`; the reader refuses a declared `Content-Length` over the limit without reading the body and checks the size of every text it parses.

### Not included

- Signed manifests. Verification of canonical bytes is independent of parsing and needs a signing scheme this package does not invent.
- Duplicate-key rejection. The decoder policy is JSON's: the last key wins, and the decoded document is validated as a whole.
- A retry policy. `429` fails the read; `Retry-After` and scheduling belong to the application.
