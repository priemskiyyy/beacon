import { expect, test } from "vitest";

import type { DecisionRevision } from "src/types/DecisionRevision";
import type { SourceRead } from "src/types/SourceRead";
import {
  createFeed,
  createSession,
} from "src/utils/internal/feeds/FeedRecord.fixture";
import type { Manifest } from "src/utils/internal/feeds/FeedRecord.fixture";

const ordered = (value: string, epoch = "v1"): DecisionRevision => ({
  kind: "ordered",
  domain: "notes-web",
  epoch,
  value,
});

const answer = (
  name: string,
  revision: DecisionRevision | undefined,
  digest: string | undefined = name,
): SourceRead<Manifest> => {
  const read: SourceRead<Manifest> = { document: { name }, digest };

  if (revision === undefined) {
    return read;
  }

  return { ...read, revision };
};

const readOnce = async (
  feed: ReturnType<typeof createFeed>,
  session: ReturnType<typeof createSession>,
  read: SourceRead<Manifest>,
) => {
  const pending = feed.feed.read(session, { mode: "join", signal: undefined });

  feed.mock.resolve(read);

  return pending;
};

test("VER-13 a lower revision is rejected and the accepted decision stays", async () => {
  const context = createFeed();
  const session = createSession();

  await readOnce(context, session, answer("b", ordered("208")));

  const outcome = await readOnce(context, session, answer("a", ordered("207")));

  expect(outcome).toMatchObject({
    status: "failed",
    error: { code: "REVISION_REGRESSION" },
  });
  expect(context.feed.getAccepted()?.document).toEqual({ name: "b" });
});

test("VER-14 one revision with different content is a conflict and the accepted decision stays", async () => {
  const context = createFeed();
  const session = createSession();

  await readOnce(context, session, answer("b", ordered("208"), "digest-b"));

  const outcome = await readOnce(
    context,
    session,
    answer("other", ordered("208"), "digest-other"),
  );

  expect(outcome).toMatchObject({
    status: "failed",
    error: { code: "REVISION_CONFLICT" },
  });
  expect(context.feed.getAccepted()?.document).toEqual({ name: "b" });
});

test("VER-15 the same decision again renews its evidence without a new revision", async () => {
  const context = createFeed();
  const session = createSession();

  await readOnce(context, session, {
    ...answer("b", ordered("208"), "digest-b"),
    expiresAt: 2_000,
  });

  context.clock.advance(500);

  await readOnce(context, session, {
    ...answer("b", ordered("208"), "digest-b"),
    expiresAt: 3_000,
  });

  expect(context.records).toContain("read-renewed");
  expect(context.feed.getAccepted()?.evidence).toMatchObject({
    receivedAt: 1_500,
    expiresAt: 3_000,
    revision: ordered("208"),
  });
});

test("VER-16 another epoch is not assumed to be newer", async () => {
  const context = createFeed();
  const session = createSession();

  await readOnce(context, session, answer("b", ordered("208")));

  const outcome = await readOnce(
    context,
    session,
    answer("c", ordered("1", "v2")),
  );

  expect(outcome).toMatchObject({
    status: "failed",
    error: { code: "REVISION_EPOCH_CHANGED" },
  });
});

test("VER-08 an ordered revision that is not a canonical decimal is an invalid document", async () => {
  const context = createFeed();

  const outcome = await readOnce(
    context,
    createSession(),
    answer("b", ordered("2e3")),
  );

  expect(outcome).toMatchObject({
    status: "failed",
    error: { code: "INVALID_DOCUMENT" },
  });
  expect(context.feed.getAccepted()).toBeNull();
});

test("a revision that moves forward replaces the decision", async () => {
  const context = createFeed();
  const session = createSession();

  await readOnce(context, session, answer("a", ordered("207")));

  const outcome = await readOnce(context, session, answer("b", ordered("208")));

  expect(outcome).toEqual({ status: "accepted", attempt: 2 });
  expect(context.feed.getAccepted()?.document).toEqual({ name: "b" });
  expect(context.accepted).toHaveLength(2);
});
