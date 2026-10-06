import type { CommandMap } from "src/types/CommandMap";
import type { MechanismContext } from "src/types/MechanismContext";
import type { MechanismSession } from "src/types/MechanismSession";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningSubject } from "src/types/RunningSubject";

/**
 * The commands of a route whose offers come from a source: a name, the
 * running subject its commands replace, an `open` that runs when a session
 * starts and is given the scope the session runs under, and the commands
 * themselves. The route compares what the source offers with that subject, so
 * the mechanism that replaces the document is the one that names `web`, and
 * the one that opens the store names `native`. A mechanism never selects a
 * release and never claims more than its commands declare.
 *
 * @example
 * ```ts
 * const mechanism = createUpdateMechanism({
 *   name: "browser-reload",
 *   subject: "web",
 *   open: (): MechanismSession<Browser> => ({ native: browser }),
 *   commands: { reload },
 * });
 * ```
 */
export type UpdateMechanism<
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  name: string;
  /** The running subject its commands replace, which a route compares an offer with. */
  subject: RunningSubject;
  open(context: MechanismContext): MechanismSession<TNative>;
  commands: TCommands;
};
