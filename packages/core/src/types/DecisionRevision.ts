/**
 * How an authority numbers its deployment decisions. An ordered revision
 * compares only within its domain and epoch, as a canonical unsigned decimal
 * string that no number size rounds; an opaque one only says that a decision
 * differs. A decision revision is never compared with a release version.
 *
 * @example
 * ```ts
 * const ordered: DecisionRevision = {
 *   kind: "ordered",
 *   domain: "notes-web-deployments",
 *   epoch: "production-v1",
 *   value: "208",
 * };
 * const opaque: DecisionRevision = { kind: "opaque", value: "policy-43" };
 * ```
 */
export type DecisionRevision =
  | { kind: "opaque"; value: string }
  | { kind: "ordered"; domain: string; epoch: string; value: string };
