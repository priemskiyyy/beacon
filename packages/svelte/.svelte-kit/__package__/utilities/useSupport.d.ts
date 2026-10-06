import type { SupportState } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
/**
 * Reads whether the running application is acceptable under the application's policy, of the provider's Beacon, through `current`; with a selector, what depends on it runs again only when the selection changes. Support is unknown until a policy is accepted, and a failing check never changes it.
 *
 * @example
 * ```ts
 * const unsupported = useSupport(({ status }) => status === "unsupported");
 * ```
 */
export declare function useSupport(): ReadableValue<SupportState>;
export declare function useSupport<TSelected>(selector: (value: SupportState) => TSelected, options?: SelectorOptions<NoInfer<TSelected>>): ReadableValue<TSelected>;
