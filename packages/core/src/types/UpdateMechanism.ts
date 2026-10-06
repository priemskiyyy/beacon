import type { CommandMap } from "src/types/CommandMap";
import type { MechanismSession } from "src/types/MechanismSession";
import type { RouteBody } from "src/types/RouteBody";

/**
 * The commands of a route whose offers come from a source: a name, an `open`
 * that runs when a session starts, and the commands themselves. A mechanism
 * never selects a release and never claims more than its commands declare.
 *
 * @example
 * ```ts
 * const mechanism = createUpdateMechanism({
 *   name: "browser-reload",
 *   open: (): MechanismSession<Browser> => ({ native: browser }),
 *   commands: { requestReload },
 * });
 * ```
 */
export type UpdateMechanism<
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  name: string;
  open(): MechanismSession<TNative>;
  commands: TCommands;
};
