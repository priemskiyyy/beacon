import type { CommandMap } from "src/types/CommandMap";
import type { NoneDecision } from "src/types/NoneDecision";
import type { Projection } from "src/types/Projection";
import type { RouteBody } from "src/types/RouteBody";
import type { TargetDecision } from "src/types/TargetDecision";
import type { UpdateMechanism } from "src/types/UpdateMechanism";

/**
 * A route that offers the release an authority names, whatever its order, so a
 * rollback is an ordinary offer. The offer is compared with the running code
 * of the mechanism's subject, and the source can only produce target and none
 * decisions.
 *
 * @example
 * ```ts
 * const options: TargetRouteOptions<Manifest, null, Browser, typeof commands> = {
 *   source: manifest.select((document) => document.routes.web),
 *   mechanism: browserReload(),
 * };
 * ```
 */
export type TargetRouteOptions<
  TDocument,
  TMetadata extends object | null,
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  source: Projection<TDocument, TargetDecision<TMetadata> | NoneDecision>;
  mechanism: UpdateMechanism<TNative, TCommands>;
};
