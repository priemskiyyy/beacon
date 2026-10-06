import type { CandidateDecision } from "src/types/CandidateDecision";
import type { CommandMap } from "src/types/CommandMap";
import type { NoneDecision } from "src/types/NoneDecision";
import type { Projection } from "src/types/Projection";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningRelease } from "src/types/RunningRelease";
import type { UpdateMechanism } from "src/types/UpdateMechanism";
import type { VersionStrategy } from "src/types/VersionStrategy";

/**
 * A route that offers a candidate only when it is admitted and orders newer
 * than what the mechanism's subject is running. The candidate's order, the strategy's input and the
 * value `current` reads all share one type, so a mismatch does not compile.
 *
 * @example
 * ```ts
 * const options: NewerRouteOptions<Lookup, null, string, SemVer, Store, typeof commands> = {
 *   source: lookup.select((document) => document.decision),
 *   version: semver(),
 *   current: (release) => release?.label ?? null,
 *   mechanism: appStoreHandoff({ appId, linking }),
 * };
 * ```
 */
export type NewerRouteOptions<
  TDocument,
  TMetadata extends object | null,
  TInput,
  TParsed,
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  source: Projection<
    TDocument,
    CandidateDecision<TInput, TMetadata> | NoneDecision
  >;
  version: VersionStrategy<TParsed, TInput>;
  /** The order of what is running, read from its release, or `null` when it cannot be said. */
  current: (release: RunningRelease | null) => TInput | null;
  mechanism: UpdateMechanism<TNative, TCommands>;
};
