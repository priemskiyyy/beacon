import type { CommandDescriptor } from "src/types/CommandDescriptor";
import type { CommandParameters } from "src/types/CommandParameters";
import type { RouteBody } from "src/types/RouteBody";

/** The members every route handle has, which a command cannot take the name of. */
type HandleMembers = {
  state?: never;
  native?: never;
  capabilities?: never;
  check?: never;
  acknowledge?: never;
};

/**
 * The commands of one mechanism or driver by name. A name becomes a method of
 * the route, so there is no universal `install`, `apply` or `updated: true`,
 * and a name a route handle already has does not compile.
 *
 * @example
 * ```ts
 * const commands: CommandMap<Browser, RouteBody, RouteBody> = { requestReload };
 * ```
 */
export type CommandMap<
  TNative,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
> = Record<
  string,
  CommandDescriptor<
    TNative,
    TOffer,
    TPrepared,
    CommandParameters,
    { kind: string }
  >
> &
  HandleMembers;
