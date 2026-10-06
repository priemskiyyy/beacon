import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningRelease } from "src/types/RunningRelease";

export const buildIdentity = (
  value: string,
  domain = "web-artifact",
): ReleaseIdentity => ({
  status: "known",
  authority: "com.example.notes",
  domain,
  value,
});

export const UNKNOWN_IDENTITY: ReleaseIdentity = {
  status: "unknown",
  reason: "not-reported",
};

export const buildRunning = (
  identity: ReleaseIdentity = buildIdentity("web-build-b"),
): RunningRelease => ({ identity, label: null, raw: {} });
