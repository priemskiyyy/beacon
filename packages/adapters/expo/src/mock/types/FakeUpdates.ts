import type { FakeUpdatesCalls } from "src/mock/types/FakeUpdatesCalls";
import type { UpdatesLike } from "src/types/UpdatesLike";

/**
 * The fake `expo-updates` module `createFakeUpdates` makes: an `UpdatesLike`
 * to pass as `updates`, and a count of the calls it received. It is a plain
 * object, so a method assigned over it is what the route meets.
 *
 * @example
 * ```ts
 * const updates: FakeUpdates = createFakeUpdates({ available: true });
 *
 * updates.fetchUpdateAsync = async () => {
 *   throw new Error("offline");
 * };
 * ```
 */
export type FakeUpdates = UpdatesLike & { calls: FakeUpdatesCalls };
