# @priemskiyyy/beacon-code-push

The React Native CodePush family as a [Beacon](../../core) route and its running reader: Microsoft's `react-native-code-push` and the forks that kept its JavaScript API, `@revopush/react-native-code-push`, `@bravemobile/react-native-code-push` and `@appzung/react-native-code-push`. CodePush owns discovery, the download, the install and the rollback; this adapter maps what it says, says so when it cannot say more, and claims nothing as running until a later boot shows it.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-code-push @revopush/react-native-code-push
```

Install the fork you use. Microsoft's package is retired: its repository is archived and its service is gone, so it is for an app that serves updates itself.

## Example

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { codePushUpdates } from "@priemskiyyy/beacon-code-push";
import CodePush from "@revopush/react-native-code-push";

const beacon = new Beacon({
  scope,
  routes: { update: codePushUpdates({ codePush: CodePush }) },
});
```

You pass the CodePush module in: the adapter never imports it, so a test passes a fake and a server render loads nothing. For AppZung's package that is `import * as CodePush from "@appzung/react-native-code-push"`, since its default export is its decorator. The adapter configures none of it.

The adapter never calls `sync`, `notifyAppReady`, `allowRestart` or `disallowRestart`. Wrap the root component with `CheckFrequency.MANUAL`, or the decorator checks, downloads and installs on its own and Beacon's state would not say what happened, and call `notifyAppReady()` yourself without the decorator.

## What it exports

| Export                          | Does                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codePushUpdates({ codePush })` | the route: `download` stages the package with the mode `ON_NEXT_RESTART`, `reload` calls `restartApp(true)`; `null` from CodePush is `none`, never "up to date" |
| `codePushBundle({ codePush })`  | the `bundle` reader, `known` by the package hash. The route supplies it by itself: pass it only to override that                                                |

The `native` reader is the installed binary: [`deviceInfo`](../device-info) or `expoApplication` of [`@priemskiyyy/beacon-expo`](../expo), so a policy can compare the two.

## Learn more

[The CodePush guide](../../../docs/code-push.md) has which fork to choose, what a check reports, the commands and their receipts, what the app must do, and what no device has run: nothing here proves a package was installed.
