import type {
  ReleaseIdentity,
  ReleaseScope,
  RunningRelease,
} from "@priemskiyyy/beacon";

import type { CleanFacts } from "src/types/internal/CleanFacts";
import type { NativeFacts } from "src/types/internal/NativeFacts";
import type { NativePlatform } from "src/types/NativePlatform";
import type { NativeReaderOptions } from "src/types/internal/NativeReaderOptions";
import { cleanText } from "src/utils/cleanText";
import { BUILD_DOMAINS } from "src/utils/constants/authority";
import {
  ANOTHER_APPLICATION_IDENTITY,
  APPLICATION_NOT_READ_IDENTITY,
  BUILD_NOT_READ_IDENTITY,
  UNSUPPORTED_PLATFORM_IDENTITY,
} from "src/utils/constants/identities";
import { readPlatform } from "src/utils/readPlatform";

const readIdentity = (
  { applicationId, build }: CleanFacts,
  platform: NativePlatform,
  domain: string = BUILD_DOMAINS[platform],
): ReleaseIdentity => {
  if (build === null) {
    return BUILD_NOT_READ_IDENTITY;
  }

  if (applicationId === null) {
    return APPLICATION_NOT_READ_IDENTITY;
  }

  return { status: "known", authority: applicationId, domain, value: build };
};

// The keys are the ones the store adapters and a support policy read: `appleMarketingVersion` takes `shortVersion`.
const readRaw = (
  { applicationId, version, build }: CleanFacts,
  platform: NativePlatform,
): RunningRelease["raw"] => {
  if (platform === "android") {
    return { applicationId, versionName: version, versionCode: build };
  }

  return { applicationId, shortVersion: version, buildNumber: build };
};

/**
 * What the binary reported becomes one running release: its build number under
 * the application id it reports, in the words of the store adapters, and what
 * it did not report stays unknown, with a reason. The platform and the
 * authority are the scope's, unless the options give them, and a platform that
 * has no build number of this kind is unknown before the SDK is asked. The
 * marketing version is the label and stays in `raw` even when the build is
 * unknown.
 */
export const readNativeRelease = (
  ask: () => NativeFacts,
  options: NativeReaderOptions,
  scope: ReleaseScope,
): RunningRelease => {
  const platform = options.platform ?? readPlatform(scope.platform);

  if (platform === null) {
    return { identity: UNSUPPORTED_PLATFORM_IDENTITY, label: null, raw: {} };
  }

  const reported = ask();

  const facts = {
    applicationId: cleanText(reported.applicationId),
    version: cleanText(reported.version),
    build: cleanText(reported.build),
  };

  if (
    facts.applicationId !== null &&
    facts.applicationId !== (options.authority ?? scope.application)
  ) {
    // Its version and build number are another application's: a policy or a route that reads the raw facts must not take them for this one's.
    return {
      identity: ANOTHER_APPLICATION_IDENTITY,
      label: null,
      raw: { applicationId: facts.applicationId },
    };
  }

  return {
    identity: readIdentity(facts, platform, options.domain),
    label: facts.version,
    raw: readRaw(facts, platform),
  };
};
