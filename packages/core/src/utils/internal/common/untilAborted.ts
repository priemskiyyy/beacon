type Raced<TValue> =
  { status: "settled"; value: TValue } | { status: "aborted" };

/**
 * Waits for the work or for the signal, whichever comes first. The work keeps
 * running when the signal wins: aborting a wait is not aborting the work.
 */
export const untilAborted = <TValue>(
  work: Promise<TValue>,
  signal: AbortSignal,
): Promise<Raced<TValue>> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      resolve({ status: "aborted" });

      return;
    }

    const onAbort = () => resolve({ status: "aborted" });

    signal.addEventListener("abort", onAbort, { once: true });

    work
      .then((value) => resolve({ status: "settled", value }), reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
