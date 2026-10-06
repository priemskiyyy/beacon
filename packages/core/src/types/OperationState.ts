/**
 * The command a route is carrying out. `indeterminate` is what remains after a
 * dispatch whose outcome was lost: the command may have taken effect, so it is
 * never retried blindly and never called cancelled. `progress` is a fraction
 * between 0 and 1 when the provider reports one, and `null` otherwise.
 *
 * @example
 * ```ts
 * const { operation } = beacon.route("ota").state.get();
 * ```
 */
export type OperationState =
  | { state: "idle" }
  | {
      state: "running";
      operation: { id: number };
      command: string;
      progress: number | null;
    }
  | {
      state: "indeterminate";
      operation: { id: number };
      command: string;
      reason: string;
    };
