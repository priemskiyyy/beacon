/** Why a source refuses an answer that renews nothing. */
export const NOT_MODIFIED_WITHOUT_DOCUMENT =
  "The backend answered not modified, but this source holds no document to renew.";

/** Why a source refuses an answer of a shape its type does not have, such as one from a client written without types. */
export const UNKNOWN_ANSWER =
  "The client answered neither changed nor not modified.";
