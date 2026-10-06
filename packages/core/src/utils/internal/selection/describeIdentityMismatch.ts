import type { ReleaseIdentity } from "src/types/ReleaseIdentity";

/** Says why two identities cannot be compared: the one that is unknown, or the authority and the domain that differ, each with both words. Only identities are named, which the observation already publishes. */
export const describeIdentityMismatch = (
  running: ReleaseIdentity,
  offered: ReleaseIdentity,
) => {
  if (running.status === "unknown") {
    return `running identity unknown: ${running.reason}`;
  }

  if (offered.status === "unknown") {
    return `offered identity unknown: ${offered.reason}`;
  }

  const differences: string[] = [];

  if (running.authority !== offered.authority) {
    differences.push(
      `authority: running ${running.authority}, offered ${offered.authority}`,
    );
  }

  if (running.domain !== offered.domain) {
    differences.push(
      `domain: running ${running.domain}, offered ${offered.domain}`,
    );
  }

  return differences.join("; ");
};
