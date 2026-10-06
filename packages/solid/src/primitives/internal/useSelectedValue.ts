import type { ObservableValue } from "@priemskiyyy/beacon";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import type { Accessor } from "solid-js";

import type { SelectorOptions } from "src/types/SelectorOptions";

/**
 * Reads a selection of an observable as an accessor. It starts from the
 * observable as it was before any session, which is what a server renders and
 * what a hydrating render has to read, and once mounted it reads the live value
 * and follows it. It subscribes only while mounted, and again when the
 * observable it resolves changes. A selection equal to the last one keeps the
 * last one, so nothing that depends on it runs again.
 */
export const useSelectedValue = <TValue, TSelected>(
  resolve: Accessor<ObservableValue<TValue>>,
  selector: (value: TValue) => TSelected,
  { isEqual = Object.is }: SelectorOptions<TSelected>,
): Accessor<TSelected> => {
  // The signal drops a write that isEqual calls the same, and keeps the last selection.
  const [selected, setSelected] = createSignal(
    selector(resolve().getInitial()),
    { equals: isEqual },
  );

  // An effect never runs on the server, and on the client it runs once the component is mounted. It is created here and not inside onMount, so it runs before an effect of the component that reads this accessor after it.
  createEffect(() => {
    const current = resolve();

    // The selector is the application's, so what it reads must not become a dependency of this effect.
    const read = () =>
      setSelected(() => untrack(() => selector(current.get())));

    read();
    onCleanup(current.subscribe(read));
  });

  return selected;
};
