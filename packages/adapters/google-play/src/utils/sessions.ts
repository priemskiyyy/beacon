import { BeaconError } from "@priemskiyyy/beacon";

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

/** The session a command belongs to. A command runs only on the handle of an open session, so any other handle is a provider that is not open. */
export const getSession = (native: PlayNative) => {
  const session = sessions.get(native);

  if (session === undefined) {
    throw new BeaconError({
      code: "DRIVER_FAILED",
      message: "The provider is not open.",
    });
  }

  return session;
};
