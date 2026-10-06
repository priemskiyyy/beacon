# @priemskiyyy/beacon-http

Your own release manifest endpoint as a [Beacon](../../core) release source. You pass in your API client's call, so your client owns the transport, authentication, retries and response validation, and this package makes no request of its own.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-http
```

## Create a source

```ts
import {
  Beacon,
  createUpdateMechanism,
  targetRoute,
} from "@priemskiyyy/beacon";
import { http } from "@priemskiyyy/beacon-http";

const manifest = http({
  name: "release-manifest",
  request: async ({ signal, validator }) => {
    const response = await fetch("/releases.json", {
      signal,
      headers: validator === null ? {} : { "if-none-match": validator },
    });

    if (response.status === 304) {
      return { status: "not-modified" };
    }

    return {
      status: "changed",
      document: parseManifest(await response.json()),
      validator: response.headers.get("etag") ?? undefined,
    };
  },
});

const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.web),
  mechanism: browserReload,
});
```

`request` receives the scope, an abort signal, the attempt number and the validator of the answer this source holds. Validate the response in your client, with the schema library you already use, before you answer: Beacon trusts the types. A thrown `BeaconError` keeps its code, and any other error fails the read with `SOURCE_FAILED` and keeps the original as `cause`.

## The answer

| Status         | Meaning                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `changed`      | the validated `document`, its `validator` for the next read, and the evidence Beacon judges it by: `revision`, `digest`, `issuer`, `expiresAt` |
| `not-modified` | the document this source holds is still the authority's answer. It renews that document; with a new `expiresAt` it also moves the expiry       |

A `not-modified` without an `expiresAt` keeps the old expiry, so an answer is never fresher than the backend said. A `not-modified` when this source holds nothing to renew, such as after the scope changed, fails the read: it never invents a document.

## Partitions

When the answers differ by account, name the account with `partition`:

```ts
const manifest = http({
  request,
  partition: () => session.userId,
});
```

The source keeps and renews an answer only for the partition it was given, so a validator or a document never crosses from one account to another. The partition is opaque text held in memory to compare with the next read: it is never stored and never sent, so it is not a place for a token.

## The standard manifest

A small, optional schema for a manifest that one application, environment, platform and distribution serves. You need not use it: any client that answers a validated document works with `http()`. When you do, `readStandardManifest` turns the response of your `fetch` into the answer, and rejects everything that is not a valid manifest.

```ts
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";

const routes = {
  web: { kind: "target" },
  binary: { kind: "candidate", order: "text" },
};

const manifest = http({
  name: "release-manifest",
  request: async ({ scope, signal, validator }) =>
    readStandardManifest({
      response: await fetch("/releases.json", {
        signal,
        headers: validator === null ? {} : { "if-none-match": validator },
      }),
      scope,
      routes,
      now: Date.now(),
    }),
});

const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.routes.web),
  mechanism: browserReload(),
});
```

`routes` declares which routes you read and what each is. The types follow the declaration: a `target` route reads a target or a none decision, a `candidate` route reads a candidate or a none decision whose `order` is `text` or `integer`, and the manifest cannot switch a route to the other kind. The document has one decision for each declared route and the optional `support` facts, whose `remediationRoute` is one of your routes.

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

### What is accepted

The whole manifest or none of it. `parseStandardManifest` (the text) and `readStandardManifest` (the response) throw a `BeaconError` that says which rule broke, and a source that throws keeps the last document it accepted.

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

### Limits

`limits` tunes what a document may be, and the defaults are documented values, not universal ideals.

| Limit      | Default  | Meaning                                                            |
| ---------- | -------- | ------------------------------------------------------------------ |
| `bytes`    | 262144   | the most bytes of a decoded document                               |
| `lifetime` | 86400000 | the most milliseconds between `issuedAt` and `expiresAt`           |
| `skew`     | 300000   | the most milliseconds a manifest may be issued ahead of your clock |

The evidence expires at the narrowest of the manifest's `expiresAt` and `now + lifetime`, so a copy that a service worker or a cache served late is never fresher than the authority said, and a manifest that has already expired is refused. A `fetch` cache option does not bypass a service worker or an intermediary, so this reader does not claim it does.

A runtime that cannot stream, such as React Native's `fetch`, reads the text whole. Stop a hostile stream early by bounding the transfer in your own `fetch`; the reader refuses a declared `Content-Length` over the limit without reading the body and checks the size of every text it parses.

### Not included

- Signed manifests. Verification of canonical bytes is independent of parsing and needs a signing scheme this package does not invent.
- Duplicate-key rejection. The decoder policy is JSON's: the last key wins, and the decoded document is validated as a whole.
- A retry policy. `429` fails the read; `Retry-After` and scheduling belong to the application.
