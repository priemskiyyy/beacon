import type { ResolvedRunningReaders } from "src/types/internal/ResolvedRunningReaders";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningReader } from "src/types/RunningReader";
import type { RunningReaders } from "src/types/RunningReaders";
import type { RunningSubject } from "src/types/RunningSubject";
import { BeaconError } from "src/utils/BeaconError";
import { READER_HINTS } from "src/utils/constants/readers";
import { RUNNING_SUBJECTS } from "src/utils/constants/subjects";
import { getRealmBootId } from "src/utils/internal/running/getRealmBootId";

type Supply = { route: string; reader: RunningReader<RunningSubject> };

// The readers the driver routes offer for their own subjects, in the order the routes were given.
const collectSupplies = (routes: Record<string, RouteDefinition>) => {
  const supplies: Partial<Record<RunningSubject, Supply[]>> = {};

  for (const [route, definition] of Object.entries(routes)) {
    if (definition.kind !== "driver") {
      continue;
    }

    const { subject, running } = definition.driver;

    if (running === undefined) {
      continue;
    }

    supplies[subject] = [
      ...(supplies[subject] ?? []),
      { route, reader: running },
    ];
  }

  return supplies;
};

// A feed route compares an offer with what its subject runs, so without a reader it could never offer anything.
const assertFeedReaders = (
  routes: Record<string, RouteDefinition>,
  readers: Partial<Record<RunningSubject, RunningReader<RunningSubject>>>,
) => {
  for (const [name, definition] of Object.entries(routes)) {
    if (definition.kind !== "feed") {
      continue;
    }

    const { subject } = definition.mechanism;

    if (readers[subject] !== undefined) {
      continue;
    }

    const hint = READER_HINTS[subject];

    const fix =
      hint === undefined
        ? "Pass a reader of your own."
        : `Pass ${hint} or a reader of your own.`;

    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: `Route "${name}" compares against the "${subject}" subject, but running.${subject} has no reader. ${fix}`,
    });
  }
};

/**
 * The readers a Beacon runs on: the application's, with the reader a driver
 * route offers for its own subject where the application passed none, and the
 * boot id of the realm where it passed none. It throws `INVALID_CONFIGURATION`
 * for what could never work: a feed route whose subject has no reader, and two
 * drivers that each supply the reader of a subject the application left alone.
 */
export const resolveRunningReaders = (
  readers: RunningReaders,
  routes: Record<string, RouteDefinition>,
): ResolvedRunningReaders => {
  const supplies = collectSupplies(routes);

  const resolved: Partial<
    Record<RunningSubject, RunningReader<RunningSubject>>
  > = {};

  for (const subject of RUNNING_SUBJECTS) {
    const explicit = readers[subject];

    if (explicit !== undefined) {
      resolved[subject] = explicit;

      continue;
    }

    const [first, second] = supplies[subject] ?? [];

    if (first === undefined) {
      continue;
    }

    // Two drivers that would each read one subject are two authorities, and Beacon does not choose between them.
    if (second !== undefined) {
      throw new BeaconError({
        code: "INVALID_CONFIGURATION",
        message: `Routes "${first.route}" and "${second.route}" both supply a reader for the "${subject}" subject. Pass running.${subject} to choose one.`,
      });
    }

    resolved[subject] = first.reader;
  }

  assertFeedReaders(routes, resolved);

  return { boot: readers.boot ?? { id: getRealmBootId() }, ...resolved };
};
