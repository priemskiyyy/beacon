import { expect, test } from "vitest";

import type { RouteBody } from "src/types/RouteBody";
import {
  BODY,
  createReferenceBeacon,
} from "src/utils/internal/commands/resolveCommand.fixture";

const NEXT: RouteBody = {
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "android-version-code",
      value: "121",
    },
  },
};

// What a compiler would not let through: a value read by a key it cannot know is not typed.
const KEY: string = "value";

const untyped = (value: object) => Reflect.get({ value }, KEY);

const start = async () => {
  const { drivers, ...context } = await createReferenceBeacon();
  const first = context.beacon.route("first");
  const second = context.beacon.route("second");

  const { observation } = first.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  const other = second.state.get().observation;

  if (other.status !== "available") {
    throw new Error("The route has no offer.");
  }

  return {
    ...context,
    drivers,
    first,
    second,
    offer: observation.offer,
    otherOffer: other.offer,
  };
};

const prepare = (
  context: Awaited<ReturnType<typeof start>>,
  body: RouteBody,
) => {
  context.drivers.first.emitter()?.prepared({ status: "ready", value: body });

  const { prepared } = context.first.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has no prepared target.");
  }

  return prepared.value;
};

test("BIND-03 a command that needs an offer is handed the offer its reference stands for", async () => {
  const context = await start();

  await expect(
    context.first.download({ offer: context.offer.ref }),
  ).resolves.toMatchObject({ status: "accepted" });
  expect(context.drivers.first.seen).toEqual([
    { command: "download", given: context.offer },
  ]);
  expect(context.drivers.first.seen[0]?.given).toBe(context.offer);
});

test("BIND-03 a command that needs a prepared target is handed the route's own", async () => {
  const context = await start();
  const prepared = prepare(context, BODY);

  await expect(
    context.first.activate({ prepared: prepared.ref }),
  ).resolves.toMatchObject({ status: "accepted" });
  expect(context.drivers.first.seen[0]?.given).toBe(prepared);
});

test("BIND-03 a prepared reference the route no longer holds is replaced, whether the target went or another came", async () => {
  const context = await start();
  const gone = prepare(context, BODY);

  context.drivers.first.emitter()?.prepared({ status: "none" });

  await expect(context.first.activate({ prepared: gone.ref })).resolves.toEqual(
    { status: "stale", reason: "replaced" },
  );

  const first = prepare(context, BODY);
  const next = prepare(context, NEXT);

  expect(next.ref).not.toBe(first.ref);
  await expect(
    context.first.activate({ prepared: first.ref }),
  ).resolves.toEqual({ status: "stale", reason: "replaced" });
  await expect(
    context.first.activate({ prepared: next.ref }),
  ).resolves.toMatchObject({ status: "accepted" });
  expect(context.drivers.first.seen).toHaveLength(1);
});

test("BIND-03 a copy of a prepared reference is foreign", async () => {
  const context = await start();
  const prepared = prepare(context, BODY);

  await expect(
    context.first.activate({ prepared: { ...prepared.ref } }),
  ).resolves.toEqual({ status: "stale", reason: "foreign" });
  expect(context.drivers.first.seen).toHaveLength(0);
});

test("BIND-03 a reference of another route, and none at all, are foreign to a caller the types do not check", async () => {
  const context = await start();
  const prepared = prepare(context, BODY);

  // A host that is not typed can call with anything, and the compiler refuses each of these.
  const call = JSON.parse("{}");
  const offerOfAnother = untyped(context.otherOffer.ref);
  const preparedOfAnother = untyped(prepared.ref);

  await expect(context.first.download(call)).resolves.toEqual({
    status: "stale",
    reason: "foreign",
  });
  await expect(context.first.activate(call)).resolves.toEqual({
    status: "stale",
    reason: "foreign",
  });
  await expect(
    context.first.download({ offer: offerOfAnother }),
  ).resolves.toEqual({ status: "stale", reason: "foreign" });
  await expect(
    context.second.activate({ prepared: preparedOfAnother }),
  ).resolves.toEqual({ status: "stale", reason: "foreign" });
  expect(context.drivers.first.seen).toHaveLength(0);
  expect(context.drivers.second.seen).toHaveLength(0);
});

test("BIND-03 an optional offer may be left out and is handed as nothing, and one that is given is checked", async () => {
  const context = await start();

  await expect(context.first.snooze()).resolves.toMatchObject({
    status: "accepted",
  });
  await expect(
    context.first.snooze({ offer: context.offer.ref }),
  ).resolves.toMatchObject({ status: "accepted" });
  await expect(
    context.first.snooze({ offer: { ...context.offer.ref } }),
  ).resolves.toEqual({ status: "stale", reason: "foreign" });

  expect(context.drivers.first.seen).toEqual([
    { command: "snooze", given: null },
    { command: "snooze", given: context.offer },
  ]);
});

test("a command that needs no reference is run as it was called", async () => {
  const context = await start();

  await expect(context.first.ping()).resolves.toMatchObject({
    status: "accepted",
  });
  expect(context.drivers.first.seen).toEqual([
    { command: "ping", given: undefined },
  ]);
});
