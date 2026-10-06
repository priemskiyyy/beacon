import type { CommandParameters } from "src/types/CommandParameters";

/**
 * What every command receives besides its references: the provider's native
 * handle, a signal that aborts the wait for it, and the parameters its caller
 * passed.
 *
 * @example
 * ```ts
 * const run = async ({ native, parameters }: CommandRunContext<Updates, { flow: Flow }>) => {
 *   await native.start(parameters.flow);
 * };
 * ```
 */
export type CommandRunContext<
  TNative extends object,
  TParameters extends CommandParameters,
> = {
  native: TNative;
  signal: AbortSignal;
  parameters: TParameters;
};
