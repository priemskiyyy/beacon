import type { ObservableValue } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../../types/ReadableValue.js";
import type { SelectorOptions } from "../../types/SelectorOptions.js";
/**
 * Reads a selection of an observable through `current`. It reads the
 * observable as it was before any session until mounted, which is what a
 * server renders and a hydrating client has to match; once mounted it reads
 * the live value and subscribes, and it lets go on unmount. A selection equal
 * to the last one is not assigned, so what depends on it does not run again.
 * `resolve` is followed, so a provider that publishes a new Beacon moves the
 * subscription.
 *
 * @example
 * ```ts
 * const state = useSelectedValue(() => beacon.current.route("web").state, selectValue, {});
 * ```
 */
export declare const useSelectedValue: <TValue, TSelected>(resolve: () => ObservableValue<TValue>, selector: (value: TValue) => TSelected, { isEqual }: SelectorOptions<TSelected>) => ReadableValue<TSelected>;
