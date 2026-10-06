import type { Gate } from "src/mock/types/Gate";

/**
 * A gate a fake provider waits at: while it is held, `wait()` does not resolve;
 * `release()` opens it and lets every waiter go. It starts open. A test holds
 * it to put an interleaving in flight, and releases it to settle that.
 *
 * @example
 * ```ts
 * const gate = createGate();
 * const fetchUpdate = async () => {
 *   await gate.wait();
 *
 *   return { id: "update-2" };
 * };
 *
 * gate.hold();
 *
 * const pending = fetchUpdate();
 *
 * gate.release();
 * await pending;
 * ```
 */
export const createGate = (): Gate => {
  const state = { held: false };
  const waiters: Array<() => void> = [];

  return {
    hold: () => {
      state.held = true;
    },
    release: () => {
      state.held = false;

      for (const resolve of waiters.splice(0)) {
        resolve();
      }
    },
    wait: () => {
      if (!state.held) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
  };
};
