/**
 * The platform a binary runs on, which decides how its build number is named:
 * an Android build by its version code, an iOS build by its build number.
 *
 * @example
 * ```ts
 * const platform: NativePlatform = "ios";
 * ```
 */
export type NativePlatform = "android" | "ios";
