import type { ObservableValue } from "@priemskiyyy/beacon";
import { untrack } from "svelte";
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
export const useSelectedValue = <TValue, TSelected>(
  resolve: () => ObservableValue<TValue>,
  selector: (value: TValue) => TSelected,
  { isEqual = Object.is }: SelectorOptions<TSelected>,
): ReadableValue<TSelected> => {
  // Raw, so the selection keeps its identity instead of being proxied.
  let selected: TSelected = $state.raw(selector(resolve().getInitial()));

  // Effects never run on the server and run after mount on the client, so both render the initial value first.
  $effect(() => {
    const observed = resolve();

    // Untracked, so a notification that arrives inside another effect, such as the provider's start, does not depend on the selection.
    const select = () =>
      (() => {
        const next = selector(observed.get());

        if (isEqual(selected, next)) {
          return;
        }

        selected = next;
      });

    select();

    return observed.subscribe(select);
  });

  return {
    get current() {
      return selected;
    },
  };
};
