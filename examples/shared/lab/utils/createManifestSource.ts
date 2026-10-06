import { createReleaseSource } from "@priemskiyyy/beacon";
import type { BeaconClock } from "@priemskiyyy/beacon";
import { createMockSource } from "@priemskiyyy/beacon/mock";

import {
  MANIFEST_FAILURE,
  MANIFEST_NAME,
} from "example-shared/lab/constants/lab";
import type { LabManifest } from "example-shared/lab/types/LabManifest";
import type { LabWorld } from "example-shared/lab/types/LabWorld";
import { createManifestAnswer } from "example-shared/lab/utils/createManifestAnswer";
import { patchWorld } from "example-shared/lab/utils/patchWorld";
import type { ValueStore } from "example-shared/types/ValueStore";
import { wait } from "example-shared/utils/wait";

type ManifestSourceOptions = {
  world: ValueStore<LabWorld>;
  clock: BeaconClock;
  /** Milliseconds every read takes before the service decides how to answer it. */
  latency: number;
};

/**
 * The release service as a source. A mock source holds or answers every read,
 * and this puts three things around it that a mock does not do by itself: the
 * answer is made when the read is answered, so its expiry is new each time; a
 * failing service rejects every read; and the reads somebody still waits for
 * are counted, since the mock counts one nobody waits for until it is settled.
 * The service also takes `latency` to answer, as a network does.
 */
export const createManifestSource = ({
  world,
  clock,
  latency,
}: ManifestSourceOptions) => {
  const mock = createMockSource<LabManifest>({ name: MANIFEST_NAME });
  let waiting = 0;

  const answer = () => {
    const read = createManifestAnswer(world.get(), clock.now());

    patchWorld(world, { expiresAt: read.expiresAt ?? null });

    return read;
  };

  const source = createReleaseSource<LabManifest>({
    name: MANIFEST_NAME,
    read: async (context) => {
      let counted = true;

      const finish = () => {
        if (!counted) {
          return;
        }

        counted = false;
        waiting -= 1;
        patchWorld(world, { waiting });
      };

      waiting += 1;
      patchWorld(world, { waiting });
      context.signal.addEventListener("abort", finish, { once: true });

      try {
        await wait(latency);

        const { failing, slow } = world.get();

        if (failing) {
          throw new Error(MANIFEST_FAILURE);
        }

        if (slow) {
          mock.hold();
        } else {
          mock.answer(answer());
        }

        return await mock.source.read(context);
      } finally {
        finish();
      }
    },
  });

  // Every read the mock holds, including one whose caller gave up, so none is left behind.
  const answerHeld = () => {
    const { held } = mock.stats();

    for (let index = 0; index < held; index += 1) {
      mock.resolve(answer());
    }

    return held;
  };

  return { source, answerHeld };
};
