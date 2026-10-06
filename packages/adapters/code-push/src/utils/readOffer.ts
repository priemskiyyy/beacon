import type { CodePushOffer } from "src/types/CodePushOffer";
import type { RemotePackageLike } from "src/types/RemotePackageLike";
import { createPackageIdentity } from "src/utils/createPackageIdentity";
import { readLabel } from "src/utils/readLabel";

/** The offer a package a check found stands for. Its flags come from a server's answer and the native side, so anything but `true` is false. */
export const readOffer = (remote: RemotePackageLike): CodePushOffer => ({
  release: { identity: createPackageIdentity(remote.packageHash) },
  label: readLabel(remote.label),
  mandatory: remote.isMandatory === true,
  failedInstall: remote.failedInstall === true,
});
