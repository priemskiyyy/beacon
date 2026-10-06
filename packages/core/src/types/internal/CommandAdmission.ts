import type { BlockReason } from "src/types/BlockReason";
import type { CommandResult } from "src/types/internal/CommandResult";
import type { CommandOperation } from "src/types/internal/CommandOperation";

/**
 * Whether a call took its route's slot, joined the identical call that holds
 * it, or was refused. An admitted call answers everyone who joins it through
 * `answer`.
 */
export type CommandAdmission =
  | {
      status: "admitted";
      operation: CommandOperation;
      answer: (outcome: CommandResult) => void;
    }
  | { status: "joined"; operation: CommandOperation }
  | { status: "blocked"; reasons: BlockReason[] };
