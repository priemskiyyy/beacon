/** Why the running bundle has no identity: CodePush reports no package, so the bundle inside the binary runs, and it names no hash. */
export const EMBEDDED_BUNDLE = "embedded-bundle";

/** Why a package has no identity, and why a download of it is unsupported: its hash is missing or blank, and the hash is all that names it. */
export const PACKAGE_HASH_MISSING = "package-hash-missing";

/** Why a download is unsupported: this device installed the package before and CodePush rolled it back. */
export const PREVIOUSLY_ROLLED_BACK = "previously-rolled-back";

/** Why a check has no offer: CodePush handed no package for this binary, which is not the same as no release, or as an update server that was asked and had none. */
export const NO_PACKAGE_FOR_BINARY = "no-package-for-binary";

/** Why a download is indeterminate: the install returned, and CodePush did not then list that package as pending. */
export const INSTALL_UNCONFIRMED = "install-unconfirmed";
