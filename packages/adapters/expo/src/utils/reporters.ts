import type { DriverEmitter } from "@priemskiyyy/beacon";

import type { ExpoBody } from "src/types/ExpoBody";
import type { ExpoNative } from "src/types/ExpoNative";

// How a command tells its route what it prepared, for as long as the session that owns the route lives.
type Reporter = DriverEmitter<ExpoBody, ExpoBody>;

const reporters = new WeakMap<ExpoNative, Reporter>();

/** Lets the commands of a session report through its route, until the session ends. */
export const bindReporter = (native: ExpoNative, reporter: Reporter) => {
  reporters.set(native, reporter);

  return () => {
    reporters.delete(native);
  };
};

/** The reporter of a session, or none once it ended. */
export const getReporter = (native: ExpoNative) => reporters.get(native);
