/**
 * Whether `semver()` admits prerelease candidates. They are excluded unless an
 * application says otherwise, and the choice is independent of how they would
 * order.
 *
 * @example
 * ```ts
 * const strategy = semver({ prereleases: "include" });
 * ```
 */
export type SemVerOptions = {
  prereleases?: "include" | "exclude";
};
