import type { PlayNative } from "src/types/PlayNative";
import type { PlaySession } from "src/utils/PlaySession";

const sessions = new WeakMap<PlayNative, PlaySession>();

/** Lets the commands of a session reach it, until the session ends. */
export const bindSession = (native: PlayNative, session: PlaySession) => {
  sessions.set(native, session);

  return () => {
    sessions.delete(native);
  };
};

/** The session a command belongs to, or none once it ended. */
export const getSession = (native: PlayNative) => sessions.get(native);
