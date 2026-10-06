import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import type { UpdateMechanism } from "src/types/UpdateMechanism";

/**
 * Declares a mechanism so that its native type and its commands are inferred
 * together: a command's `run` receives the native handle and the reference it
 * declared, typed, without an annotation. Annotate what `run` returns with its
 * receipt (`Promise<ProviderResult<ReloadReceipt>>`), or the receipt's `kind`
 * widens to `string`.
 *
 * @example
 * ```ts
 * const mechanism = createUpdateMechanism({
 *   name: "browser-reload",
 *   subject: "web",
 *   open: () => ({ native: browser }),
 *   commands: { reload },
 * });
 * ```
 */
export const createUpdateMechanism = <
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
>(
  mechanism: UpdateMechanism<TNative, TCommands>,
): UpdateMechanism<TNative, TCommands> => mechanism;
