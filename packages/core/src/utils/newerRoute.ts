import type { CommandMap } from "src/types/CommandMap";
import type { FeedRoute } from "src/types/FeedRoute";
import type { NewerRouteOptions } from "src/types/NewerRouteOptions";
import type { Release } from "src/types/Release";
import type { RouteBody } from "src/types/RouteBody";
import { describeMissingRunning } from "src/utils/internal/running/describeMissingRunning";
import { readRunningRelease } from "src/utils/internal/running/readRunningRelease";
import { selectNewer } from "src/utils/internal/selection/selectNewer";

/**
 * A route that offers a candidate only when it is admitted by the version
 * strategy and orders newer than what is running. An equal order with another
 * identity is explained, not offered: use `targetRoute` when a different
 * release should replace it.
 *
 * @example
 * ```ts
 * const binary = newerRoute({
 *   source: lookup.select((document) => document.decision),
 *   version: semver(),
 *   current: (release) => release?.label ?? null,
 *   mechanism: appStoreHandoff({ appId, linking }),
 * });
 * ```
 */
export const newerRoute = <
  TDocument,
  TMetadata extends object | null,
  TInput,
  TParsed,
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
>({
  source,
  version,
  current,
  mechanism,
}: NewerRouteOptions<
  TDocument,
  TMetadata,
  TInput,
  TParsed,
  TNative,
  TCommands
>): FeedRoute<
  TDocument,
  Release<TMetadata> & { order: TInput },
  TNative,
  TCommands
> => ({
  kind: "feed",
  source: source.source,
  select: (document, running) => {
    const release = readRunningRelease(running, mechanism.subject);

    return selectNewer({
      decision: source.project(document),
      running: release,
      missing: describeMissingRunning(running, mechanism.subject),
      currentOrder: current(release),
      version,
    });
  },
  mechanism,
});
