import type { expoUpdates } from "src/expoUpdates";

/**
 * The route `expoUpdates()` makes, which is what `applyUpdate` takes the
 * handle of.
 *
 * @example
 * ```ts
 * const routes: { ota: ExpoRoute } = { ota: expoUpdates({ updates: Updates }) };
 * ```
 */
export type ExpoRoute = ReturnType<typeof expoUpdates>;
