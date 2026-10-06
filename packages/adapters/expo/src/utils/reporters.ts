import type { ExpoNative } from "src/types/ExpoNative";
import type { Reporter } from "src/types/internal/Reporter";

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
