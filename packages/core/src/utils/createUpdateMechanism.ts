import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import type { UpdateMechanism } from "src/types/UpdateMechanism";

/**
 * Declares a mechanism so that its native type and its commands are inferred
 * together: a command's `run` receives the native handle and the reference it
 * declared, typed, without an annotation.
 *
 * @example
 * ```ts
 * const mechanism = createUpdateMechanism({
 *   name: "browser-reload",
 *   open: () => ({ native: browser }),
 *   commands: { requestReload },
 * });
 * ```
 */
export const createUpdateMechanism = <
  TNative,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
>(
  mechanism: UpdateMechanism<TNative, TCommands>,
): UpdateMechanism<TNative, TCommands> => mechanism;
