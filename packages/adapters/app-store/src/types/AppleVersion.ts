/**
 * A marketing version parsed into its three numbers, the missing ones zero, as
 * `CFBundleShortVersionString` allows one to three of them.
 *
 * @example
 * ```ts
 * const version: AppleVersion = [3, 2, 0];
 * ```
 */
export type AppleVersion = [major: number, minor: number, patch: number];
