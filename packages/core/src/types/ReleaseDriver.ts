import type { CommandMap } from "src/types/CommandMap";
import type { DriverContext } from "src/types/DriverContext";
import type { DriverSession } from "src/types/DriverSession";
import type { RouteBody } from "src/types/RouteBody";
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
  prepares: boolean;
  open(
    context: DriverContext<TOffer, TPrepared>,
  ): DriverSession<TNative, TOffer>;
  commands: TCommands;
};
