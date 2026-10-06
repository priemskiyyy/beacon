import type {
  CandidateDecision,
  NoneDecision,
  TargetDecision,
} from "@priemskiyyy/beacon";

import type { ManifestMetadata } from "src/types/ManifestMetadata";
import type { OrderKind } from "src/types/OrderKind";
import type { OrderValues } from "src/types/OrderValues";
import type { RouteDeclaration } from "src/types/RouteDeclaration";

/**
 * The decision a declared route holds once the manifest is read: exactly the
 * decisions its declaration allows, so a route reads it without a check.
 *
 * @example
 * ```ts
 * const web: StandardDecision<{ kind: "target" }> = { kind: "none", reason: "up-to-date" };
 * ```
 */
export type StandardDecision<TDeclaration extends RouteDeclaration> =
  TDeclaration extends {
    kind: "candidate";
    order: infer TOrder extends OrderKind;
  }
    ? CandidateDecision<OrderValues[TOrder], ManifestMetadata> | NoneDecision
    : TargetDecision<ManifestMetadata> | NoneDecision;
