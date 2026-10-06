import { createMockSource } from "src/mock/createMockSource";
import { createTestClock } from "src/mock/createTestClock";
import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { Session } from "src/types/internal/Session";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { ReleaseSource } from "src/types/ReleaseSource";
import type { BeaconError } from "src/utils/BeaconError";
import { FeedRecord } from "src/utils/internal/feeds/FeedRecord";
import { ResourceScope } from "src/utils/internal/runtime/ResourceScope";

export type Manifest = { name: string };

export const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

export const createSession = (id = 1): Session => ({
  id,
  scope: new ResourceScope(() => {}),
});

type FeedOptions = { timeout?: number; source?: ReleaseSource<Manifest> };

export const createFeed = ({ timeout = 10_000, source }: FeedOptions = {}) => {
  const mock = createMockSource<Manifest>();
  const clock = createTestClock({ now: 1_000 });
  const log: string[] = [];
  const accepted: AcceptedFeed[] = [];
  const failures: BeaconError[] = [];
  const records: string[] = [];

  const feed = new FeedRecord({
    source: source ?? mock.source,
    clock,
    timeout,
    getScope: () => SCOPE,
    hooks: {
      started: (attempt) => log.push(`started ${attempt}`),
      accepted: (feed) => accepted.push(feed),
      failed: (attempt, error) => {
        log.push(`failed ${attempt}`);
        failures.push(error);
      },
      record: (type) => records.push(type),
    },
  });

  return { feed, mock, clock, log, accepted, failures, records };
};

// A feed whose owner is told of each start by `onStart`, which may reenter it.
export const createFeedWithStartHook = (onStart: () => void) => {
  const mock = createMockSource<Manifest>();

  const feed = new FeedRecord({
    source: mock.source,
    clock: createTestClock({ now: 1_000 }),
    timeout: 10_000,
    getScope: () => SCOPE,
    hooks: {
      started: onStart,
      accepted: () => {},
      failed: () => {},
      record: () => {},
    },
  });

  return { feed, mock };
};
