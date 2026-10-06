// Typechecked, never run: the real CodePush modules satisfy the structural type
// the adapter uses, so Beacon never imports one at runtime, and a route's
// methods are derived from the commands the driver declares. The forks share
// one JavaScript API, so one type covers Microsoft's `react-native-code-push`,
// `@revopush/react-native-code-push` and `@bravemobile/react-native-code-push`,
// and AppZung's `@appzung/react-native-code-push`, whose module has the same
// members as named exports.
import type {
  OfferReference,
  PreparedReference,
  RouteHandle,
  RunningReaders,
} from "@priemskiyyy/beacon";
import type AppZungDecorator from "@appzung/react-native-code-push";
import type * as AppZungCodePush from "@appzung/react-native-code-push";
import type BraveCodePush from "@bravemobile/react-native-code-push";
import type RevopushCodePush from "@revopush/react-native-code-push";
import type MicrosoftCodePush from "react-native-code-push";
import { expectTypeOf } from "vitest";

import { codePushBundle } from "src/codePushBundle";
import { codePushUpdates } from "src/codePushUpdates";
import type { CodePushDownloadReceipt } from "src/types/CodePushDownloadReceipt";
import type { CodePushLike } from "src/types/CodePushLike";
import type { CodePushNative } from "src/types/CodePushNative";
import type { CodePushReloadReceipt } from "src/types/CodePushReloadReceipt";

type IsAny<TValue> = 0 extends 1 & TValue ? true : false;

declare const microsoft: typeof MicrosoftCodePush;
declare const revopush: typeof RevopushCodePush;
declare const brave: typeof BraveCodePush;
declare const appzung: typeof AppZungCodePush;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf<IsAny<typeof microsoft>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<typeof revopush>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<typeof brave>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<typeof appzung>>().toEqualTypeOf<false>();
expectTypeOf<
  IsAny<ReturnType<typeof microsoft.checkForUpdate>>
>().toEqualTypeOf<false>();
expectTypeOf<
  IsAny<ReturnType<typeof appzung.checkForUpdate>>
>().toEqualTypeOf<false>();

expectTypeOf(microsoft).toExtend<CodePushLike>();
expectTypeOf(revopush).toExtend<CodePushLike>();
expectTypeOf(brave).toExtend<CodePushLike>();
expectTypeOf(appzung).toExtend<CodePushLike>();

export const update = codePushUpdates({ codePush: microsoft });

export const bundle: RunningReaders["bundle"] = codePushBundle(microsoft);

export const forks = [
  codePushUpdates({ codePush: revopush }),
  codePushUpdates({ codePush: brave }),
  codePushUpdates({ codePush: appzung }),
];

declare const appzungDecorator: typeof AppZungDecorator;

// @ts-expect-error -- the default export of AppZung's package is its decorator: the module is `import * as`.
codePushUpdates({ codePush: appzungDecorator });

// @ts-expect-error -- the module is the SDK's, not a random object.
codePushUpdates({ codePush: {} });

// @ts-expect-error -- the SDK is required: this adapter imports nothing itself.
codePushUpdates({});

declare const like: CodePushLike;

// The type names one install mode and two update states, and the members it lists.
// @ts-expect-error -- no immediate install is reachable: it restarts the app without asking anyone.
export const immediate = like.InstallMode.IMMEDIATE;

// @ts-expect-error -- the library's own checking and installing is never called.
export const synced = like.sync();

// @ts-expect-error -- marking an update successful is the application's.
export const marked = like.notifyAppReady();

// @ts-expect-error -- allowing or forbidding restarts is the application's.
export const allowed = like.allowRestart();

// @ts-expect-error -- the argument order of a check differs between the forks, so a check takes none.
export const checked = like.checkForUpdate("deployment-key");

// The declaration of `restartApp` says it returns nothing, and every fork's returns a promise.
export const restartsWithNothing: CodePushLike["restartApp"] = () => {};

export const restartsWithAPromise: CodePushLike["restartApp"] = async () => {};

// @ts-expect-error -- a restart answers nothing or a promise, not a number.
export const restartsWithANumber: CodePushLike["restartApp"] = () => 1;

declare const handle: RouteHandle<"update", typeof update>;

declare const offer: OfferReference<"update">;

declare const prepared: PreparedReference<"update">;

export const download = handle.download({ offer });

export const reload = handle.reload({ prepared });

// @ts-expect-error -- a download needs the offer the user was shown.
handle.download();

// @ts-expect-error -- a reload needs a prepared target, not an offer.
handle.reload({ prepared: offer });

// @ts-expect-error -- a download needs an offer, not a prepared target.
handle.download({ offer: prepared });

// @ts-expect-error -- the download command takes no parameters of its own: no install mode to choose.
handle.download({ offer, installMode: 0 });

// @ts-expect-error -- the library's own sync is not a command of the route.
handle.sync();

expectTypeOf(handle.native.get()).toEqualTypeOf<CodePushNative | null>();

export const receipt = async () => {
  const settled = await handle.download({ offer });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<CodePushDownloadReceipt>();

    // @ts-expect-error -- an accepted download claims no installation.
    return settled.receipt.installed;
  }

  return null;
};

export const reloadReceipt = async () => {
  const settled = await handle.reload({ prepared });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<CodePushReloadReceipt>();

    // @ts-expect-error -- an accepted reload claims no package is running.
    return settled.receipt.updated;
  }

  return null;
};
