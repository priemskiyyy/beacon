import type { PlayInstallStatus } from "src/types/PlayInstallStatus";

/**
 * What a fresh query of Play says, in the four categories its API keeps apart.
 * `available` carries the version code and the flows Play allows now, with
 * its priority and staleness as provider facts; `in-progress` is a flow this
 * app started that Play still holds; `unknown` is anything else, such as no
 * Play services or an ineligible setup, which says nothing about what exists.
 *
 * @example
 * ```ts
 * const info: PlayUpdateInfo = { availability: "not-available" };
 * ```
 */
export type PlayUpdateInfo =
  | { availability: "not-available" }
  | { availability: "unknown" }
  | {
      availability: "available";
      versionCode: number;
      flexible: boolean;
      immediate: boolean;
      priority: number;
      stalenessDays: number | null;
      installStatus: PlayInstallStatus;
    }
  | { availability: "in-progress"; installStatus: PlayInstallStatus };
