# @priemskiyyy/beacon-firebase-remote-config

Firebase Remote Config as a [Beacon](../../core) release source, for React Native (`@react-native-firebase/remote-config`) and the web (`firebase/remote-config`). The canonical use is a forced-upgrade gate: the minimum build you keep in Remote Config, read by `minimumBuild`. The source builds your document from what the server sent, and it never turns an application default, a key nothing defines or a configuration that never fetched into a server's answer.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-firebase-remote-config
```

You pass in the SDK you already use. `@react-native-firebase/remote-config` (25 or later) or `firebase` (9.8.3 or later) is an optional peer dependency, and the adapter never imports either. Their types were checked against the oldest release named here and the newest the adapter was run against (26 and 12), and nothing of their runtime was. React Native Firebase is native code, so in Expo it needs a development build.

## Example

```ts
import { minimumBuild } from "@priemskiyyy/beacon";
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import * as RemoteConfig from "@react-native-firebase/remote-config";

const config = firebaseRemoteConfig({
  remoteConfig: RemoteConfig.getRemoteConfig(),
  sdk: RemoteConfig,
  document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
});

export const policy = minimumBuild({
  source: config.select((document) => document.minimumBuild),
});
```

Pass `policy` to the `Beacon`. A parameter the server did not send, or a default of your own, fails the read, so support stays `unknown` and the app is never locked out by a missing key.

## Options

| Option           | Meaning                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `remoteConfig`   | the instance your application already set up: it keeps its defaults and fetch settings, and the source configures neither |
| `sdk`            | the module that goes with it                                                                                              |
| `document`       | builds your document from the activated parameters, and throws for what it cannot accept                                  |
| `maxAge`         | milliseconds an answer holds after the fetch it came from, the SDK's minimum fetch interval by default                    |
| `onFetchFailure` | `fail`, the default, fails the read when the fetch fails; `use-activated` answers with the values activated earlier       |
| `name`           | the source's name in diagnostics and evidence                                                                             |

## Learn more

[The Firebase Remote Config guide](../../../docs/firebase-remote-config.md) has the whole forced-upgrade recipe from the console to the screen, what a check reports, the expiry and what the source never does, and [support](../../../docs/support.md#a-minimum-native-build) the table of verdicts.
