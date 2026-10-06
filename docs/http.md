---
description: "Turn your own release manifest endpoint into a Beacon release source through your client, and use the optional standard manifest and its parser."
---

# HTTP

`@priemskiyyy/beacon-http` makes your release manifest endpoint a [source](routes.md#sources). You pass in your client's call, so your client owns the transport, authentication, retries and validation. This package makes no request of its own.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-http
```

## Create a source

`http({ name, request })` answers a source. `request` runs once for each read.

```ts
import { http } from "@priemskiyyy/beacon-http";
import type { HttpAnswer } from "@priemskiyyy/beacon-http";
import type { NoneDecision, TargetDecision } from "@priemskiyyy/beacon";

type Releases = { web: TargetDecision | NoneDecision };

// Your validator, with the schema library you already use.
declare const parseReleases: (input: unknown) => Releases;

export const manifest = http({
  name: "release-manifest",
  request: async ({ signal, validator }): Promise<HttpAnswer<Releases>> => {
    const response = await fetch("/releases.json", {
      signal,
      headers: validator === null ? {} : { "if-none-match": validator },
    });

    if (response.status === 304) {
      return { status: "not-modified" };
    }

    const etag = response.headers.get("etag");

    return {
      status: "changed",
      document: parseReleases(await response.json()),
      ...(etag === null ? {} : { validator: etag }),
    };
  },
});
```

`request` receives the `scope`, an abort `signal`, the `attempt` number and the `validator` of the answer this source holds for that scope, or `null`. Validate the response in your client before you answer: Beacon trusts the types. A thrown `BeaconError` keeps its code, and any other error fails the read with `SOURCE_FAILED` and keeps the original as `cause`.

### The answer

| Status         | Meaning                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `changed`      | the validated `document`, its `validator` for the next read, and the evidence Beacon judges it by: `revision`, `digest`, `issuer`, `expiresAt` |
| `not-modified` | the document this source holds is still the authority's answer. It renews that document; with a new `expiresAt` it also moves the expiry       |

A `not-modified` without an `expiresAt` keeps the old expiry, so an answer is never fresher than the backend said. A `not-modified` when the source holds nothing to renew, such as after the scope changed, fails the read with `SOURCE_FAILED`. It never invents a document.

The source remembers the last answer it accepted, only for the scope it was read for. The `validator` you receive is the one of that scope, so a validator or a document never crosses from one account to another. See [scopes](scopes.md#partitions).

## The standard manifest

A small, optional schema for a manifest that one application, environment, platform and distribution serves. You need not use it: any client that answers a validated document works with `http()`. When you do, `readStandardManifest` turns the response of your `fetch` into the answer and rejects everything that is not a valid manifest.

```ts
import { targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

const routes = {
  web: { kind: "target" },
  binary: { kind: "candidate", order: "integer" },
} satisfies RouteDeclarations;

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

export const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.routes.web),
  mechanism: browserReload(),
});

export const support = manifest.select((document) => document.support);
```

`routes` declares which routes you read and what each is. The types follow the declaration:

- A `target` route reads a target or a none decision.
- A `candidate` route reads a candidate or a none decision, whose `order` is `text` or `integer`. Use `text` with a strategy that parses a string, such as `semver()`, and `integer` with `integer()`.
- The manifest cannot switch a route to the other kind. A decision of the wrong kind is `INVALID_DOCUMENT`.

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
        "identity": {
          "status": "known",
          "authority": "com.example.notes",
          "domain": "native-android-build",
          "value": "112"
        },
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

| Field                                                    | Rule                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`                                          | must be `1`                                                                                                              |
| `application`, `environment`, `platform`, `distribution` | must repeat the scope exactly. A manifest never states a `partition`                                                     |
| `decisionRevision`                                       | `{ kind: "opaque", value }`, or `{ kind: "ordered", domain, epoch, value }` with a canonical decimal `value`             |
| `issuedAt`, `expiresAt`                                  | UTC timestamps such as `2026-09-27T10:00:00Z`, with an optional fraction of up to three digits                           |
| `routes`                                                 | one decision for each declared route: `target`, `candidate` or `none`                                                    |
| `support`                                                | optional: `revision`, `subject`, `deniedReleaseIds`, `reasonCode` and `remediationRoute`, which must be a declared route |

A decision is `{ kind: "target", release }`, `{ kind: "candidate", release }` where the release carries `order`, or `{ kind: "none", reason }`. A release has an `identity` and optionally a `label`, a `compatibility` and `metadata`. A compatibility is `compatible` with a `basis`, `incompatible` with `reasons`, `delegated` with an `authority`, `unknown` with a `reason`, or `not-applicable`.

Every text is 1 to 256 characters, a list has at most 256 items, and `metadata` has at most 16 entries of short strings. A key that could corrupt a registry (`__proto__`, `constructor`, `prototype`) is refused.

### What is accepted

The whole manifest or none of it. `readStandardManifest` (the response) and `parseStandardManifest` (the text) throw a `BeaconError` that says which rule broke, and a source that throws keeps the last document it accepted.

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

The `ETag` is the validator for the next read and never the revision. A field the schema does not name is ignored and never reaches the document. A repeated JSON key keeps its last value, because the text is decoded as JSON.

### Evidence

A valid manifest becomes a read with all its evidence present: the `revision`, a `digest` of the routes' decisions without their renewable times, and the narrowest `expiresAt`. The support facts carry a revision of their own, so a policy update under the same decision is a renewal, not a conflict.

The evidence expires at the narrowest of the manifest's `expiresAt` and `now + lifetime`. A copy that a service worker or a cache served late is never fresher than the authority said, and a manifest that has already expired is refused. A `fetch` cache option does not bypass a service worker or an intermediary, and this reader does not claim it does.

### Limits

`limits` tunes what a document may be. The defaults are documented values, not universal ideals.

| Limit      | Default    | Meaning                                                            |
| ---------- | ---------- | ------------------------------------------------------------------ |
| `bytes`    | 262,144    | the most bytes of a decoded document                               |
| `lifetime` | 86,400,000 | the most milliseconds between `issuedAt` and `expiresAt`           |
| `skew`     | 300,000    | the most milliseconds a manifest may be issued ahead of your clock |

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

The example text is not a manifest, so this call throws `INVALID_DOCUMENT` at run time. Answer `{ status: "changed", ...read }` from `request` when it succeeds.

## Not included

- Signed manifests. Verification of canonical bytes is independent of parsing and needs a signing scheme this package does not invent.
- Duplicate-key rejection. The decoder policy is JSON's: the last key wins, and the decoded document is validated as a whole.
- A retry policy. `429` fails the read. `Retry-After` and scheduling belong to the application.
