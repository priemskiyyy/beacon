import type { JournalStorageFixture } from "src/testing/types/JournalStorageFixture";

/**
 * What a journal storage's conformance suite is run over: a name for the
 * report, and a `create` that makes a fixture over an empty backend for every
 * test.
 *
 * @example
 * ```ts
 * const options: JournalStorageConformanceOptions = {
 *   name: "mock",
 *   create: () => ({ storage: createMockJournalStorage() }),
 * };
 * ```
 */
export type JournalStorageConformanceOptions = {
  name: string;
  create: () => JournalStorageFixture | Promise<JournalStorageFixture>;
};
