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
