import { createTestClock } from "@priemskiyyy/beacon/mock";

import { TIMELINE_LENGTH } from "example-shared/lab/constants/lab";
import type { LabBoot } from "example-shared/lab/types/LabBoot";
import type { LabControls } from "example-shared/lab/types/LabControls";
import type { LabDraft } from "example-shared/lab/types/LabDraft";
import type { LabNative } from "example-shared/lab/types/LabNative";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import type { ReleaseLabOptions } from "example-shared/lab/types/ReleaseLabOptions";
import type { TimelineBody } from "example-shared/lab/types/TimelineBody";
import type { TimelineEntry } from "example-shared/lab/types/TimelineEntry";
import type { LabWorld } from "example-shared/lab/types/LabWorld";
import type { WorldEvent } from "example-shared/lab/types/WorldEvent";
import { createDraftParticipant } from "example-shared/lab/utils/createDraftParticipant";
import { createJournalStorage } from "example-shared/lab/utils/createJournalStorage";
import { createLabBeacon } from "example-shared/lab/utils/createLabBeacon";
import { createManifestSource } from "example-shared/lab/utils/createManifestSource";
import { createWorld } from "example-shared/lab/utils/createWorld";
import { driveClock } from "example-shared/lab/utils/driveClock";
import { patchWorld } from "example-shared/lab/utils/patchWorld";
import { recordBeacon } from "example-shared/lab/utils/recordBeacon";
import { createEventLog } from "example-shared/utils/createEventLog";
import { createValueStore } from "example-shared/utils/createValueStore";

/**
 * Builds one Beacon around a scripted world, so an application shows every
 * important behavior with no network. The world is a release service that a
 * control publishes, withdraws, slows and breaks, a deployment that serves the
 * builds, a support policy, and an unsaved draft. Nothing starts here: the
 * document's Beacon is started by whoever renders it, as an application's own
 * provider would, and a reload boots another Beacon over the same journal.
 */
export const createReleaseLab = ({
  clock = createTestClock({ now: Date.now() }),
  tick = null,
  latency = 0,
}: ReleaseLabOptions = {}): ReleaseLab => {
  const { log, add } = createEventLog<TimelineEntry>(TIMELINE_LENGTH);
  const world = createValueStore(createWorld());
  const draft = createValueStore<LabDraft>({ dirty: false, locked: false });
  const records = new Map<string, string>();
  const storage = createJournalStorage(records);
  const manifest = createManifestSource({ world, clock, latency });
  let nextId = 1;
  let number = 0;

  let stopRecording = () => {};

  const record = (body: TimelineBody, at = clock.now()) => {
    add({ ...body, id: nextId, at, boot: number });
    nextId += 1;
  };

  const announce = (event: WorldEvent) => {
    record({ source: "world", event });
  };

  // The browser the lab plays: a reload is a request, and the navigation completes when `install` says so.
  const browser: LabNative = {
    requestReload: () => announce({ type: "reload-requested" }),
  };

  const createBoot = (): LabBoot => {
    number += 1;

    const { served } = world.get();

    const beacon = createLabBeacon({
      boot: { id: `boot-${number}` },
      build: served,
      manifest: manifest.source,
      browser,
      storage,
      clock,
    });

    beacon.disruptions.register(createDraftParticipant(draft));
    stopRecording = recordBeacon({ beacon, record });
    announce({ type: "booted", build: served });

    return { number, build: served, beacon };
  };

  const boot = createValueStore(createBoot());

  // The old document's Beacon ends for good, and its last diagnostics are kept before the new one begins.
  const replaceDocument = () => {
    boot.get().beacon.dispose();
    stopRecording();
    boot.set(createBoot());
  };

  // A decision the release service makes is a new revision, which is how a rollback is told from a stale answer.
  const decide = (patch: Partial<LabWorld>) => {
    patchWorld(world, { ...patch, revision: world.get().revision + 1 });
  };

  const serve = (build: number) => {
    if (world.get().lagging) {
      return;
    }

    patchWorld(world, { served: build });
  };

  const controls: LabControls = {
    publish: () => {
      const build = world.get().deployed + 1;

      decide({ deployed: build, decision: "target" });
      serve(build);
      announce({ type: "published", build });
    },
    publishRequired: () => {
      const build = world.get().deployed + 1;

      decide({ deployed: build, decision: "target", minimumBuild: build });
      serve(build);
      announce({ type: "required", build });
    },
    rollBack: () => {
      const build = Math.max(1, world.get().deployed - 1);

      decide({ deployed: build, decision: "target" });
      serve(build);
      announce({ type: "rolled-back", build });
    },
    noUpdate: () => {
      decide({ decision: "none" });
      announce({ type: "no-update" });
    },
    endRunning: () => {
      const { build } = boot.get();

      if (build === null) {
        return;
      }

      decide({ endedBuilds: [...world.get().endedBuilds, build] });
      announce({ type: "ended", build });
    },
    setFailing: (failing) => {
      patchWorld(world, { failing });
      announce({ type: "manifest-failing", failing });
    },
    setSlow: (slow) => {
      patchWorld(world, { slow });
      announce({ type: "manifest-slow", slow });

      if (slow) {
        return;
      }

      controls.answerHeld();
    },
    answerHeld: () => {
      const reads = manifest.answerHeld();

      if (reads === 0) {
        return;
      }

      announce({ type: "manifest-answered", reads });
    },
    expire: () => {
      const { expiresAt } = world.get();

      if (expiresAt === null) {
        return;
      }

      controls.skip(Math.max(expiresAt - clock.now(), 0));
    },
    skip: (milliseconds) => {
      clock.advance(milliseconds);
      announce({ type: "time-skipped", milliseconds });
    },
    setLagging: (lagging) => {
      patchWorld(world, { lagging });

      if (!lagging) {
        patchWorld(world, { served: world.get().deployed });
      }

      announce({ type: "deployment-lagging", lagging });
    },
    setDraft: (dirty) => {
      if (draft.get().locked) {
        return;
      }

      draft.set({ ...draft.get(), dirty });
      announce({ type: "draft", dirty });
    },
    check: (reason = "manual") => boot.get().beacon.check({ reason }),
    install: () => {
      replaceDocument();
    },
    reset: () => {
      boot.get().beacon.dispose();
      stopRecording();
      records.clear();
      log.clear();
      world.set(createWorld());
      draft.set({ dirty: false, locked: false });
      boot.set(createBoot());
      announce({ type: "reset" });
    },
  };

  const stopTicking = tick === null ? () => {} : driveClock(clock, tick);

  return {
    boot,
    world,
    draft,
    timeline: log,
    controls,
    dispose: () => {
      stopTicking();
      boot.get().beacon.dispose();
      stopRecording();
    },
  };
};
