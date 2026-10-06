/**
 * The part of CodePush's `LocalPackage` the adapter uses: a package on the
 * device, by the hash its release has and the label its server gave it. It is
 * installed only with the mode the module names `ON_NEXT_RESTART`. The running
 * package of a development build can carry `_isDebugOnly`, which the forks set
 * where an update sits on disk while the bundle inside the binary runs. The
 * real package satisfies it.
 *
 * @example
 * ```ts
 * import CodePush from "react-native-code-push";
 *
 * const local: LocalPackageLike | null = await CodePush.getUpdateMetadata();
 * ```
 */
export type LocalPackageLike = {
  packageHash: string;
  label: string;
  isMandatory: boolean;
  install(installMode: number): Promise<void>;
  _isDebugOnly?: boolean;
};
