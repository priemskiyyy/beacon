/** The scripted world around the Beacon: the release service, the deployment and the browser. */
export type LabWorld = {
  /** The number of the release service's latest decision, sent as its ordered revision. */
  revision: number;
  /** The newest build the release service names. */
  deployed: number;
  /** The build a new document loads now; it trails `deployed` while a deployment lags. */
  served: number;
  /** Whether the service names a build (`target`) or says it has nothing (`none`). */
  decision: "target" | "none";
  minimumBuild: number;
  endedBuilds: number[];
  failing: boolean;
  slow: boolean;
  lagging: boolean;
  /** Reads started and not answered yet, not counting those nobody waits for anymore. */
  waiting: number;
  /** Epoch milliseconds when the last answer stops holding, or `null` before any. */
  expiresAt: number | null;
};
