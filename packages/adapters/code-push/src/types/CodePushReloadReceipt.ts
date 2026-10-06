/**
 * What an accepted reload proves: CodePush was asked to restart the app for
 * the pending package, and the call returned. The restart may be held back
 * while the application has disallowed restarts, no code after it is
 * guaranteed to run, and only the next boot shows which package runs.
 *
 * @example
 * ```ts
 * const receipt: CodePushReloadReceipt = { kind: "reload-requested" };
 * ```
 */
export type CodePushReloadReceipt = { kind: "reload-requested" };
