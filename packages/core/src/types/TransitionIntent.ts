import type { RunningSubject } from "src/types/RunningSubject";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { TargetBinding } from "src/types/TargetBinding";

/**
 * What Beacon recorded before it asked a provider to replace the realm: which
 * command on which route, from which boot, what was running and what it aimed
 * at. It is an intent, never proof that the dispatch happened or that anything
 * was installed. It holds no native object, credential, manifest or account
 * detail.
 *
 * @example
 * ```ts
 * const { intent } = beacon.transitions.get().latest ?? {};
 * ```
 */
export type TransitionIntent = {
  operation: { id: number };
  boot: { id: string };
  route: string;
  command: string;
  subject: RunningSubject;
  /** What was running under the subject, or `null` when it was not known. */
  current: ReleaseIdentity | null;
  /** What the command aimed at, or `null` when it named none. */
  target: ReleaseIdentity | null;
  binding: TargetBinding;
  createdAt: number;
  expiresAt: number;
};
