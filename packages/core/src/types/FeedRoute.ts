import type { CommandMap } from "src/types/CommandMap";
import type { ReleaseSelection } from "src/types/ReleaseSelection";
import type { ReleaseSource } from "src/types/ReleaseSource";
import type { Release } from "src/types/Release";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningSubject } from "src/types/RunningSubject";
import type { UpdateMechanism } from "src/types/UpdateMechanism";

/**
 * A route whose offers come from a release source and whose commands come from
 * a mechanism: the source says what the authority wants, `select` compares it
 * with what is running, and the mechanism carries the commands. Build one with
 * `targetRoute` or `newerRoute` rather than by hand.
 *
 * @example
 * ```ts
 * const route: FeedRoute<Manifest, Release, Browser, typeof commands> = targetRoute({
 *   subject: "web",
 *   source: manifest.select((document) => document.routes.web),
 *   mechanism: browserReload(),
 * });
 * ```
 */
export type FeedRoute<
  TDocument,
  TRelease extends Release<object | null>,
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  kind: "feed";
  subject: RunningSubject;
  source: ReleaseSource<TDocument>;
  select(
    document: TDocument,
    running: RunningApplication,
  ): ReleaseSelection<TRelease>;
  mechanism: UpdateMechanism<TNative, TCommands>;
};
