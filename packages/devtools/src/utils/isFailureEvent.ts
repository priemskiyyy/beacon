import { EVENT_FAILURES } from "src/utils/constants/events";

/** Whether an event type is one of the failures the launcher reports. A type this version does not know is not one. */
export const isFailureEvent = (type: string) =>
  Object.entries(EVENT_FAILURES).some(
    ([name, failure]) => failure && name === type,
  );
