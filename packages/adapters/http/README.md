# @priemskiyyy/beacon-http

Your release manifest as a [Beacon](../../core) release source. `standardManifestSource` asks for a manifest at a URL and reads it, so a file next to your app is one call, and `http` is the door for your own client, which owns the transport, authentication, retries and response validation.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-http
```

## Example

```ts
import { targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { standardManifestSource } from "@priemskiyyy/beacon-http";

const manifest = standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
});

const web = targetRoute({
  source: manifest.select((release) => release.routes.web),
  mechanism: browserReload(),
});
```

The file is what your build writes next to the app, with the id of the build it shipped, and a static host can serve it as it is:

```json
{
  "schemaVersion": 1,
  "routes": {
    "web": { "kind": "target", "release": { "identity": "a91b44e" } }
  }
}
```

An `identity` written as a text is a build of this application: known, under `scope.application` and the domain `web-artifact`, which is what `webBuild` reads. Serve the file with `Cache-Control: no-cache`, and keep it out of a service worker's precache. With no `expiresAt` the evidence holds for 24 hours from the read, and every read the server confirms starts the window again.

## A manifest with more

A service that writes the optional facts gets the refusal of a stale copy and of another scope's file. This one declares a second route, `binary: { kind: "candidate", order: "text", domain: "ios-build" }`, and a `support` fact that denies a build and names `web` as the route that remedies it:

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
    "web": { "kind": "target", "release": { "identity": "web-build-a" } },
    "binary": {
      "kind": "candidate",
      "release": { "identity": "412", "label": "2.5.0", "order": "2.5.0" }
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

## Options

| `standardManifestSource` | Meaning                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `url`                    | where the manifest is served                                                                                  |
| `routes`                 | the routes you read, each `{ kind: "target" }` or `{ kind: "candidate", order }`, and the `domain` of its ids |
| `fetch`                  | the client that makes the request, the global `fetch` by default                                              |
| `headers`                | sent with every request, such as an authorization header                                                      |
| `name`                   | the source's name in diagnostics and evidence, `manifest` by default                                          |
| `limits`                 | the bounds of a manifest: `bytes`, `lifetime` and `skew`                                                      |

`http({ name, fetch })` makes a source from a client of your own: `fetch` receives the scope, a signal, the validator and the clock, and answers a validated `document` or `not-modified`. `readStandardManifest` and `parseStandardManifest` are the standard schema as functions, for a client of your own.

## Learn more

[The HTTP guide](../../../docs/http.md) has the whole schema and what is accepted, how to serve the file so that it is fresh, the optional times, revision and scope, a client of your own, partitions and the limits. [Getting started](../../../docs/getting-started.md) uses it end to end.
