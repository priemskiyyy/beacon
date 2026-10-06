import type { CommandParameters } from "src/types/CommandParameters";
import type { CommandDescriptor } from "src/types/CommandDescriptor";
import type { Impact } from "src/types/Impact";
import type { TargetBinding } from "src/types/TargetBinding";

/** Another command holds this route, or the runtime's one disruptive slot. */
export const OPERATION_IN_PROGRESS = "operation-in-progress";

/** The route's last command may have taken effect and was never confirmed. */
export const OPERATION_INDETERMINATE = "operation-indeterminate";

/** A participant registered or left while the command was settling. */
export const SAFETY_CHANGED = "safety-changed";

/** Why a route stays unresolved after an accepted request the old realm is still alive to see. */
export const DISPATCH_UNCONFIRMED = "dispatch-unconfirmed";

/** Why a route stays unresolved when its caller stopped waiting after the dispatch. */
export const ABORTED_AFTER_DISPATCH = "aborted-after-dispatch";

/** The keys of a call that Beacon reads itself; everything else is the command's parameters. */
export const CONTROL_KEYS: Array<keyof CommandParameters> = [
  "offer",
  "prepared",
  "signal",
];

/**
 * What each impact means to the coordinator: a disruptive command takes the
 * runtime's one slot, and one that replaces the realm keeps its reservations
 * until the application acknowledges. A new impact cannot be added without
 * deciding both.
 */
export const IMPACT_EFFECTS = {
  "document-replacement": { disruptive: true, replacesRealm: true },
  "javascript-restart": { disruptive: true, replacesRealm: true },
  "native-update-flow": { disruptive: true, replacesRealm: false },
  "worker-takeover": { disruptive: true, replacesRealm: false },
  "external-handoff": { disruptive: true, replacesRealm: false },
  "may-activate-on-next-start": { disruptive: false, replacesRealm: false },
} satisfies Record<Impact, { disruptive: boolean; replacesRealm: boolean }>;

type Reference = CommandDescriptor<
  object,
  { release: never },
  { release: never },
  CommandParameters,
  { kind: string }
>["reference"];

/** Every reference a command can declare. */
export const COMMAND_REFERENCES = {
  offer: true,
  prepared: true,
  "optional-offer": true,
  none: true,
} satisfies Record<Reference, true>;

/** Every binding a command can declare, each mapped to itself so that a name read back from storage becomes the binding without a cast. */
export const TARGET_BINDINGS: Record<TargetBinding, TargetBinding> = {
  "unpinned-navigation": "unpinned-navigation",
  "provider-current": "provider-current",
  "exact-instance": "exact-instance",
  "store-destination": "store-destination",
};
