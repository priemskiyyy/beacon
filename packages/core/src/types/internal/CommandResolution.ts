import type { CommandRunContext } from "src/types/CommandRunContext";
import type { CommandParameters } from "src/types/CommandParameters";
import type { ProviderResult } from "src/types/ProviderResult";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { StaleReason } from "src/types/StaleReason";

/** What the runtime gives a command besides its references. */
type CommandBase = CommandRunContext<object, CommandParameters>;

/**
 * A command whose references are still what they were shown to be: the
 * reference it used, and the call that runs it with that reference bound in.
 */
export type CommandResolution =
  | {
      status: "resolved";
      reference: object | null;
      /** The identity the command aims at, or `null` when it names none. */
      target: ReleaseIdentity | null;
      invoke: (base: CommandBase) => Promise<ProviderResult<{ kind: string }>>;
    }
  | { status: "stale"; reason: StaleReason };
