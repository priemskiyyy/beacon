/**
 * The kind of code that can be executing: the native binary, the JavaScript
 * bundle, the web document or a service worker. They update independently, so
 * each has its own running fact.
 *
 * @example
 * ```ts
 * const subject: RunningSubject = "native";
 * ```
 */
export type RunningSubject = "native" | "bundle" | "web" | "worker";
