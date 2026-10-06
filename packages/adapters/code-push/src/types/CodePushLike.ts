import type { LocalPackageLike } from "src/types/LocalPackageLike";
import type { RemotePackageLike } from "src/types/RemotePackageLike";

/**
 * The part of a CodePush module the adapter uses. Pass the module itself: the
 * default export of `react-native-code-push`, `@revopush/react-native-code-push`
 * or `@bravemobile/react-native-code-push`, or `import * as CodePush` of
 * `@appzung/react-native-code-push`. The adapter never imports it, so a test
 * passes a fake, and a server render loads nothing.
 *
 * It asks `checkForUpdate` with no argument, since the forks disagree on their
 * order, and it names one install mode and two update states, so no call the
 * type does not list can be made: no `sync`, no `notifyAppReady`, no
 * `allowRestart`, no immediate install. `restartApp` is declared to return
 * nothing, though every fork's returns a promise, so what it returns is
 * awaited and a rejection fails the command.
 *
 * @example
 * ```ts
 * import CodePush from "react-native-code-push";
 *
 * const update = codePushUpdates({ codePush: CodePush });
 * ```
 */
export type CodePushLike = {
  checkForUpdate(): Promise<RemotePackageLike | null>;
  getUpdateMetadata(updateState?: number): Promise<LocalPackageLike | null>;
  restartApp(onlyIfUpdateIsPending?: boolean): void | Promise<void>;
  InstallMode: { ON_NEXT_RESTART: number };
  UpdateState: { RUNNING: number; PENDING: number };
};
