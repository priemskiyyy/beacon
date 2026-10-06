import type { CodePushLike } from "src/types/CodePushLike";

/**
 * Options for `codePushUpdates()` and `codePushBundle()`. `codePush` is the
 * CodePush module the application already set up. The adapter configures none of it: no deployment
 * key, server, release history, check frequency or install mode. The app's own
 * `CodePush({ checkFrequency: MANUAL })` decorator keeps the library from
 * checking and installing by itself.
 *
 * @example
 * ```ts
 * import CodePush from "react-native-code-push";
 *
 * const options: CodePushOptions = { codePush: CodePush };
 * ```
 */
export type CodePushOptions = {
  codePush: CodePushLike;
};
