import type { ProviderResult } from "src/types/ProviderResult";

/** The receipt a command's `run` can accept with. */
export type ReceiptOf<TCommand> = TCommand extends {
  run(...args: never[]): Promise<ProviderResult<infer TReceipt>>;
}
  ? TReceipt
  : never;
