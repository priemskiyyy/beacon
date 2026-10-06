import type { CommandDescriptor } from "src/types/CommandDescriptor";
import type { RouteBody } from "src/types/RouteBody";

/**
 * The commands of one mechanism or driver by name. A name becomes a method of
 * the route, so there is no universal `install`, `apply` or `updated: true`.
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
  CommandDescriptor<TNative, TOffer, TPrepared, object, { kind: string }>
>;
