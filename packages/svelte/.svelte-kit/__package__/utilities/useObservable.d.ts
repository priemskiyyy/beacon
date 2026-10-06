import type { ObservableValue } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
/**
 * Reads any observable of Beacon through `current` and follows it; with a
 * selector, what depends on it runs again only when the selection changes. It
 * is what the other utilities are made of, for the observable they do not
 * name, such as a route's `native`. The observable itself is not reactive.
 *
 * @example
 * ```ts
 * const native = useObservable(beacon.route("ota").native);
 * ```
 */
export declare function useObservable<TValue>(value: ObservableValue<TValue>): ReadableValue<TValue>;
export declare function useObservable<TValue, TSelected>(value: ObservableValue<TValue>, selector: (value: TValue) => TSelected, options?: SelectorOptions<NoInfer<TSelected>>): ReadableValue<TSelected>;
