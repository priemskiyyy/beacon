import type { CommandMap } from "src/types/CommandMap";
import type { NoneDecision } from "src/types/NoneDecision";
import type { Projection } from "src/types/Projection";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningSubject } from "src/types/RunningSubject";
import type { TargetDecision } from "src/types/TargetDecision";
import type { UpdateMechanism } from "src/types/UpdateMechanism";

/**
 * A route that offers the release an authority names, whatever its order, so a
 * rollback is an ordinary offer. `subject` is the running code the offer is
 * compared with, and the source can only produce target and none decisions.
 *
 * @example
 * ```ts
 * const options: TargetRouteOptions<Manifest, null, Browser, typeof commands> = {
 *   subject: "web",
 *   source: manifest.select((document) => document.routes.web),
 *   mechanism: browserReload(),
 * };
 * ```
 */
export type TargetRouteOptions<
  TDocument,
  TMetadata extends object | null,
  TNative,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  subject: RunningSubject;
  source: Projection<TDocument, TargetDecision<TMetadata> | NoneDecision>;
  mechanism: UpdateMechanism<TNative, TCommands>;
};
