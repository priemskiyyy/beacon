import type { ObservableValue } from "@priemskiyyy/beacon";
import { computed, onMounted, onWatcherCleanup, shallowRef, watch } from "vue";
import type { ComputedRef } from "vue";

import type { SelectorOptions } from "src/types/SelectorOptions";

/**
 * Reads a selection of an observable as a computed ref. It starts as the
 * observable was before any session, which is what a server renders and what a
 * hydrating render has to read, and once mounted it switches to the live value
 * and follows it until unmount. `resolve` is read again when what it reads
 * changes, such as a provider's Beacon, and the subscription follows it.
 *
 * @example
 * ```ts
 * const state = useSelectedValue(() => beacon.value.route("web").state, selectValue, {});
 * ```
 */
export const useSelectedValue = <TValue, TSelected>(
  resolve: () => ObservableValue<TValue>,
  selector: (value: TValue) => TSelected,
  { isEqual = Object.is }: SelectorOptions<TSelected>,
): ComputedRef<TSelected> => {
  // The last selection is also kept apart from the ref: a listener that read the ref would make an effect that starts a Beacon command depend on it.
  let latest = selector(resolve().getInitial());
  const selected = shallowRef(latest);

  const select = (next: TSelected) => {
    if (isEqual(latest, next)) {
      return;
    }

    latest = next;
    selected.value = next;
  };

  onMounted(() => {
    watch(
      resolve,
      (current) => {
        select(selector(current.get()));
        onWatcherCleanup(
          current.subscribe(() => {
            select(selector(current.get()));
          }),
        );
      },
      { immediate: true, flush: "sync" },
    );
  });

  // Read-only, and the snapshot keeps its identity instead of being proxied.
  return computed(() => selected.value);
};
