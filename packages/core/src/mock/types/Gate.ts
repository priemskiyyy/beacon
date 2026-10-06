/**
 * The gate `createGate` makes: open until it is held, so a fake provider that
 * waits at it is slow only when the test says so.
 *
 * @example
 * ```ts
 * const gate = createGate();
 *
 * gate.hold();
 * gate.release();
 * ```
 */
export type Gate = {
  /** Closes the gate: every `wait()` from now on is pending until `release()`. */
  hold: () => void;
  /** Opens the gate, and lets every waiter go. */
  release: () => void;
  /** Resolves at once while the gate is open, and when `release()` opens it while it is held. */
  wait: () => Promise<void>;
};
