import type { DownloadProgressLike } from "src/types/DownloadProgressLike";
import type { LocalPackageLike } from "src/types/LocalPackageLike";

/**
 * The part of CodePush's `RemotePackage` the adapter uses: an update a check
 * found, by the hash of its release, with whether it is mandatory and whether
 * this device installed it before and rolled it back. `download` is called as
 * a method of the package, since the SDK's reads the package it is called on.
 * The real package satisfies it.
 *
 * @example
 * ```ts
 * import CodePush from "react-native-code-push";
 *
 * const remote: RemotePackageLike | null = await CodePush.checkForUpdate();
 * ```
 */
export type RemotePackageLike = {
  packageHash: string;
  label: string;
  isMandatory: boolean;
  failedInstall: boolean;
  download(
    progress?: (progress: DownloadProgressLike) => void,
  ): Promise<LocalPackageLike>;
};
