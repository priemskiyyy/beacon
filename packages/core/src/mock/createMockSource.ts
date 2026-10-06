import type { MockSource } from "src/mock/types/MockSource";
import type { MockSourceStats } from "src/mock/types/MockSourceStats";
import type { SourceRead } from "src/types/SourceRead";
import type { SourceReadContext } from "src/types/SourceReadContext";
import { createReleaseSource } from "src/utils/createReleaseSource";

type HeldRead<TDocument> = {
  resolve: (read: SourceRead<TDocument>) => void;
  reject: (error: Error) => void;
};

/**
 * A scriptable source for tests. Reads are held until the test settles them
 * with `resolve` or `reject`, or answered at once after `answer`; nothing
 * settles by itself, so an interleaving is a sequence of calls, never a sleep.
 *
 * @example
 * ```ts
 * const mock = createMockSource<Manifest>({ name: "manifest" });
 *
 * mock.answer({ document: manifest });
 * ```
 */
export const createMockSource = <TDocument>({
  name = "mock-source",
}: { name?: string } = {}): MockSource<TDocument> => {
  const contexts: SourceReadContext[] = [];
  const held: Array<HeldRead<TDocument>> = [];

  let answer: SourceRead<TDocument> | null = null;
  let aborted = 0;

  const source = createReleaseSource<TDocument>({
    name,
    read: (context) => {
      contexts.push(context);
      context.signal.addEventListener(
        "abort",
        () => {
          aborted += 1;
        },
        { once: true },
      );

      if (answer !== null) {
        return Promise.resolve(answer);
      }

      return new Promise((resolve, reject) => {
        held.push({ resolve, reject });
      });
    },
  });

  const settleOldest = (settle: (read: HeldRead<TDocument>) => void) => {
    const read = held.shift();

    if (read === undefined) {
      throw new Error("The mock source has no held read to settle.");
    }

    settle(read);
  };

  return Object.freeze({
    source,
    answer: (read: SourceRead<TDocument>) => {
      answer = read;
    },
    hold: () => {
      answer = null;
    },
    resolve: (read: SourceRead<TDocument>) =>
      settleOldest((oldest) => oldest.resolve(read)),
    reject: (error: Error) => settleOldest((oldest) => oldest.reject(error)),
    contexts: () => [...contexts],
    stats: (): MockSourceStats => ({
      reads: contexts.length,
      held: held.length,
      aborted,
    }),
  });
};
