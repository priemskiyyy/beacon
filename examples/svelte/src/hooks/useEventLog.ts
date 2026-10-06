import type { ReadableValue } from "@priemskiyyy/beacon-svelte";
import { createSubscriber } from "svelte/reactivity";

import type { EventLog } from "example-shared/types/EventLog";

/** The entries of a lab log through `current`; what reads them runs again when the log changes. */
export const useEventLog = <T>(log: EventLog<T>): ReadableValue<T[]> => {
  const subscribe = createSubscriber((update) => log.subscribe(update));

  return {
    get current() {
      subscribe();

      return log.getSnapshot();
    },
  };
};
