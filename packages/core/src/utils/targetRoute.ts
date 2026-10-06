import type { CommandMap } from "src/types/CommandMap";
import type { FeedRoute } from "src/types/FeedRoute";
import type { Release } from "src/types/Release";
import type { RouteBody } from "src/types/RouteBody";
import type { TargetRouteOptions } from "src/types/TargetRouteOptions";
import { readRunningRelease } from "src/utils/internal/running/readRunningRelease";
import { selectTarget } from "src/utils/internal/selection/selectTarget";

/**
 * A route that offers the release an authority names when it is a different,
 * comparable release from the one running: the way to express a rollback, a
 * redeployment or an opaque deployment. An unknown or incomparable identity is
 * inconclusive, never a difference.
 *
 * @example
 * ```ts
 * const web = targetRoute({
 *   subject: "web",
 *   source: manifest.select((document) => document.routes.web),
 *   mechanism: browserReload(),
 * });
 * ```
 */
export const targetRoute = <
  TDocument,
  TMetadata extends object | null,
  TNative,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
>({
  subject,
  source,
  mechanism,
}: TargetRouteOptions<TDocument, TMetadata, TNative, TCommands>): FeedRoute<
  TDocument,
  Release<TMetadata>,
  TNative,
  TCommands
> => ({
  kind: "feed",
  subject,
  source: source.source,
  select: (document, running) =>
    selectTarget({
      decision: source.project(document),
      running: readRunningRelease(running, subject),
    }),
  mechanism,
});
