import { createSignal, onCleanup, onMount } from "solid-js";
import type { Accessor } from "solid-js";

import type { EventLog } from "example-shared/types/EventLog";

/** An event log as an accessor that follows it once mounted. */
export const useEventLog = <T>(log: EventLog<T>): Accessor<T[]> => {
  const [entries, setEntries] = createSignal(log.getSnapshot());

  onMount(() => {
    const read = () => setEntries(log.getSnapshot());

    read();
    onCleanup(log.subscribe(read));
  });

  return entries;
};
