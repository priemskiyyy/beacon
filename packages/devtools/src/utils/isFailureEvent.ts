import { FAILURE_EVENT_TYPES } from "src/utils/constants/events";

/** Whether an event type is one of the failures the launcher reports. */
export const isFailureEvent = (type: string) =>
  FAILURE_EVENT_TYPES.some((failure) => failure === type);
