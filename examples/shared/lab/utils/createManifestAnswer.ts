import type { SourceRead } from "@priemskiyyy/beacon";

import {
  ISSUER,
  MANIFEST_TTL,
  REVISION_DOMAIN,
  REVISION_EPOCH,
} from "example-shared/lab/constants/lab";
import type { LabManifest } from "example-shared/lab/types/LabManifest";
import type { LabWorld } from "example-shared/lab/types/LabWorld";
import { createDecision } from "example-shared/lab/utils/createDecision";

/**
 * What the release service answers at `now`. The envelope is new at every
 * read, while the revision and the digest change only with the decision, so a
 * second read of the same decision renews it and never offers it again.
 */
export const createManifestAnswer = (
  world: LabWorld,
  now: number,
): SourceRead<LabManifest> => {
  const document: LabManifest = {
    web: createDecision(world),
    support: {
      minimumBuild: world.minimumBuild,
      endedBuilds: [...world.endedBuilds],
    },
  };

  return {
    document,
    revision: {
      kind: "ordered",
      domain: REVISION_DOMAIN,
      epoch: REVISION_EPOCH,
      value: String(world.revision),
    },
    // A real service sends a hash; the content itself is the fingerprint here.
    digest: JSON.stringify(document),
    issuer: ISSUER,
    expiresAt: now + MANIFEST_TTL,
  };
};
