import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";

import type { EventLog } from "example-shared/types/EventLog";

/** The entries of a log as a read-only ref, subscribed while the component is mounted. */
export const useEventLog = <T>(log: EventLog<T>) => {
  const entries = shallowRef(log.getSnapshot());

  let unsubscribe = () => {};

  onMounted(() => {
    entries.value = log.getSnapshot();
    unsubscribe = log.subscribe(() => {
      entries.value = log.getSnapshot();
    });
  });

  onBeforeUnmount(() => {
    unsubscribe();
  });

  return computed(() => entries.value);
};
