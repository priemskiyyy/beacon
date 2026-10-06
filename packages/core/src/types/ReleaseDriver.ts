import type { CommandMap } from "src/types/CommandMap";
import type { DriverContext } from "src/types/DriverContext";
import type { DriverSession } from "src/types/DriverSession";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningReader } from "src/types/RunningReader";
import type { RunningSubject } from "src/types/RunningSubject";

/**
 * A route whose provider owns both the question and the answer, such as Expo
 * Updates, Google Play or a service worker: it checks, reports what it is
 * ready to do, and carries the commands of that provider. `prepares` says
 * whether the provider can report a prepared target at all.
 *
 * @example
 * ```ts
 * const ota = createReleaseDriver<Updates, UpdateBody, UpdateBody, typeof commands>({
 *   name: "expo-updates",
 *   subject: "bundle",
 *   prepares: true,
 *   open: ({ emit }) => ({ native: updates, check }),
 *   commands,
 * });
 * ```
 */
export type ReleaseDriver<
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
> = {
  name: string;
  /** The running subject this provider replaces, so an intent can be read back against it. */
  subject: RunningSubject;
  /**
   * The local reader of what its subject runs, such as the update the bundle
   * was made from, used only when the application passes no reader for that
   * subject in `running`. It reads what the provider's own module says is
   * running and writes no fact itself: a reader the application passes always
   * wins, and two drivers that supply one subject need the application to
   * choose.
   */
  running?: RunningReader<RunningSubject>;
  prepares: boolean;
  /**
   * The native manager this provider must have to itself, such as the one
   * update manager of the app. Only one open session holds it: a second
   * session that would open the same manager fails to open, and its route
   * reports `DRIVER_FAILED`, instead of racing the first for the provider.
   */
  exclusive?: object;
  open(
    context: DriverContext<TOffer, TPrepared>,
  ): DriverSession<TNative, TOffer>;
  commands: TCommands;
};
