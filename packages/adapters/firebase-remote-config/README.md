# @priemskiyyy/beacon-firebase-remote-config

Firebase Remote Config as a [Beacon](../../core) release source, for React Native (`@react-native-firebase/remote-config`) and the web (`firebase/remote-config`). The canonical use is a forced-upgrade gate: the minimum build you keep in Remote Config, read by a support policy. The source builds your document from what the server sent, and it never turns an application default, a key nothing defines or a configuration that never fetched into a server's answer.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-firebase-remote-config
```

You pass in the SDK you already use. `@react-native-firebase/remote-config` (25 or later) or `firebase` (9.8.3 or later) is an optional peer dependency, and the adapter never imports either. Their types were checked against the oldest release named here and the newest the adapter was run against (26 and 12), and nothing of their runtime was.

## Create a source

```ts
import { supportPolicy } from "@priemskiyyy/beacon";
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import { integer } from "@priemskiyyy/beacon/versions";
import * as RemoteConfig from "@react-native-firebase/remote-config";

const build = integer();

const config = firebaseRemoteConfig({
  remoteConfig: RemoteConfig.getRemoteConfig(),
  sdk: RemoteConfig,
  document: ({ remote }) => ({
    minimumBuild: build.parse(remote("minimum_build")),
  }),
});

export const policy = supportPolicy({
  source: config.select((document) => document.minimumBuild),
  evaluate: (minimumBuild, running) => {
    // Your rule: compare the running native build with minimumBuild.
    return { status: "supported", reasons: [], remediation: [] };
  },
});
```

On the web, `sdk` is `import * as RemoteConfig from "firebase/remote-config"` and `remoteConfig` is `getRemoteConfig(app)`. The instance and the module must be the same SDK's: a web module does not compile with a native instance.

Read `minimum_build` with a parser that rejects what is not a build, such as `integer()`. The server's text is passed as it is, an empty text included, and `Number("")` is `0`, which is no minimum at all.

## Options

| Option           | Meaning                                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `remoteConfig`   | the instance `getRemoteConfig()` returned, set up by the application: its defaults and its fetch settings stay yours                                                                                      |
| `sdk`            | the module namespace of the same SDK                                                                                                                                                                      |
| `document`       | builds the document from the activated parameters, and throws for what it cannot accept                                                                                                                   |
| `name`           | labels the source in evidence and diagnostics, `firebase-remote-config` by default                                                                                                                        |
| `maxAge`         | milliseconds an answer holds after the fetch it came from, above zero. The SDK's `minimumFetchIntervalMillis` by default. It cannot make the SDK fetch sooner                                             |
| `onFetchFailure` | `fail` (the default) fails the read when the fetch fails. `use-activated` answers with the values activated earlier, dated by their own fetch: the check then succeeds although the server did not answer |

`document` reads the parameters through two functions. `remote(key)` is the text the server sent, and it throws, which fails the read, when the key is a default or is nowhere. `source(key)` says `remote`, `default` or `missing`, for a document that accepts a default knowingly.

## What a read does

A read calls `ensureInitialized`, then `fetchAndActivate`, then reads the values, all on the SDK you passed in. The fetch is the source's own, so that the time of the last fetch dates the values that are activated. The SDK answers a fetch from its cache, with no request and no new time, for as long as its minimum fetch interval says, so a check is cheap.

| What the SDK reports                                   | What the check reports                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| a fetched and activated value, source `remote`         | the document, fresh until the fetch that got the values is `maxAge` old                                                                              |
| a value whose source is `default`, `static` or unknown | the read fails with `SOURCE_FAILED` when the document reads it with `remote()`: no document, no verdict                                              |
| a fetch that rejects, in `fail` mode                   | the read fails with what the SDK threw, and the last accepted answer stays                                                                           |
| a fetch that rejects, in `use-activated` mode          | the check **succeeds**, although the server did not answer, and the evidence is dated by the old fetch, so it is usually `expired`                   |
| a configuration that never fetched                     | the read fails with `SOURCE_FAILED`. The time of the last fetch is -1 on the web and Android, and 0 on iOS, and only a time above zero dates a value |
| an SDK that cannot initialize                          | the read fails                                                                                                                                       |
| a document that throws                                 | the read fails with what it threw, and a `BeaconError` keeps its code                                                                                |

The answer carries no revision, digest or issuer: Firebase exposes no template version, so none is made up. The evidence expires at `fetchTimeMillis + (maxAge ?? minimumFetchIntervalMillis)`, in the device clock that Beacon reads too. A debug build that sets the interval to 0 would have every answer expire on arrival, so give it a `maxAge`. A `maxAge` shorter than the interval does not make the SDK fetch sooner: the answer is expired until the interval lapses.

With `use-activated` the support verdict is `unknown` with the reason `expired` once the old values have lapsed, and the evaluation they produced stays beside it. Choosing how long to trust them is the application's: a `maxAge` longer than the time since the fetch makes them `fresh`.

## Honest limits

- A read fetches and activates for the whole application, at the moment of the check. An application that activates on its own schedule writes its own source with `createReleaseSource`.
- Real-time updates are not observed. The source subscribes to nothing and never calls `onConfigUpdate`; [the guide](../../../docs/firebase-remote-config.md#real-time-updates) has the recipe that activates and checks.
- A fetch cannot be aborted. Beacon's check timeout is 10 seconds and Firebase's fetch timeout is 60, so a check can fail with `SOURCE_TIMEOUT` while the fetch goes on, and it may activate its values after the check gave up. The next check finds them.
- Remote Config has no partition. Its cache belongs to the installation, so a value fetched for one account is served to the next until the interval lapses. `scope.partition` makes Beacon forget the old answer, and cannot make the SDK fetch again.
- `use-activated` dates the values by the last successful fetch. That is when they were activated only if everything that fetches also activates: a fetch your own code makes without activating moves the time forward and leaves the old values in place.
- The source never configures the SDK: no `setConfigSettings`, no `defaultConfig`, no `settings`.

## Verification

| Claim                                                                                                          | How it is checked                                                                                                             | Status                                               |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Nothing is asked of the SDK until a read                                                                       | `testReleaseSource` and its own test                                                                                          | tested against a fake                                |
| A default, a missing key and an unknown source are never a server's answer, and support stays `unknown`        | scenarios through Beacon over a fake that keeps the web SDK's `getSource()` answers                                           | tested against a fake                                |
| The expiry is the fetch time plus `maxAge` or the interval, a cache hit keeps it, and -1 and 0 both mean never | scenarios through Beacon with the test clock                                                                                  | tested against a fake                                |
| Both failure modes, a slow fetch and a session that ends during one                                            | scenarios through Beacon with a held fetch                                                                                    | tested against a fake                                |
| The real types satisfy the structural ones, and the web module refuses a native instance                       | `firebaseRemoteConfig.contracts.ts`, typechecked against `firebase` 12.19.0 and `@react-native-firebase/remote-config` 26.4.0 | typechecked, never run                               |
| The web SDK's fetch time, cache hit, `getSource()` values, activation and failure behavior                     | read from `@firebase/remote-config` 0.9.2 and run once by hand in Node over a fake IndexedDB and a scripted `fetch`           | verified by hand; not in CI, and no Firebase project |
| The package runs under the JavaScript environment of a React Native app                                        | the `firebase-remote-config-hermes` project, which removes what Hermes lacks, and a scan of the built entry                   | tested, not on a device                              |
| Native `fetchAndActivate` and `ensureInitialized` refresh the values and the fetch time the source reads       | read from the JavaScript and native sources of `@react-native-firebase/remote-config` 26.4.0                                  | UNVERIFIED on a device                               |
| iOS answers 0 and Android -1 before any fetch                                                                  | RNFB's own comment and its iOS helper, which reads the time of a missing date                                                 | UNVERIFIED on a device                               |
| The native iOS module can answer a source called `unknown`                                                     | RNFB's iOS helper has that branch; the source reads it as no value                                                            | UNVERIFIED on a device                               |
| Native fetches inside the minimum interval reach no server and move no time                                    | the web SDK does, as run above; the native SDKs were not read                                                                 | UNVERIFIED on a device                               |
| Throttling: the error a throttled fetch rejects with, and how long a device stays throttled                    | not seen                                                                                                                      | UNVERIFIED on a device                               |
| When activation reaches the screens that read the same SDK                                                     | not seen                                                                                                                      | UNVERIFIED on a device                               |
| Expo: a development build with the React Native Firebase config plugin                                         | not run                                                                                                                       | UNVERIFIED on a device                               |
| A real Firebase project: its template, a removed parameter, a 304                                              | not run                                                                                                                       | UNVERIFIED against a Firebase project                |
| The `onConfigUpdate` recipe                                                                                    | it compiles against the SDK's types                                                                                           | UNVERIFIED on a device                               |

A fake proves how Beacon maps what the SDK says. It does not prove what a device's Remote Config answers.
