import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { createRoot, createSignal } from "solid-js";
import { expect, test } from "vitest";

import { createWebBeacon } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";
import { countBeacon } from "src/counted.fixture";
import { mountWithProvider } from "src/mount.fixture";
import { useDisruption } from "src/primitives/useDisruption";
import { settle } from "src/settle.fixture";

const draftEditor = (
  overrides: Partial<DisruptionParticipant> = {},
): DisruptionParticipant => ({
  name: "draft-editor",
  impacts: ["document-replacement"],
  reserve: () => ({ status: "reserved", release: () => {} }),
  ...overrides,
});

test("useDisruption registers while mounted and unregisters on unmount", async () => {
  const { beacon } = createWebBeacon();

  const { dispose } = mountWithProvider({ beacon: () => beacon }, () => {
    useDisruption(
      draftEditor({
        reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
      }),
    );
  });

  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "unsaved-draft", participant: { name: "draft-editor" } }],
  });

  dispose();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
});

test("useDisruption registers once, and Beacon asks the participant's closures for the state of the moment", async () => {
  const counted = countBeacon(createWebBeacon().beacon);
  const [dirty, setDirty] = createSignal(true);
  const asked = { count: 0 };

  const { dispose } = mountWithProvider(
    { beacon: () => counted.beacon },
    () => {
      useDisruption(
        draftEditor({
          reserve: () => {
            asked.count += 1;

            if (dirty()) {
              return { status: "blocked", code: "unsaved-draft" };
            }

            return { status: "reserved", release: () => {} };
          },
        }),
      );
    },
  );

  counted.beacon.start();

  await expect(counted.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });

  setDirty(false);
  setDirty(true);
  setDirty(false);

  await expect(counted.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  // One registration is asked once per command: two would have been asked twice.
  expect(asked.count).toBe(2);
  expect(counted.registrations).toEqual({ live: 1, total: 1 });

  dispose();

  expect(counted.registrations).toEqual({ live: 0, total: 1 });
});

test("a provider whose beacon expression yields the same Beacon again does not register the participant again", () => {
  const counted = countBeacon(createWebBeacon().beacon);
  const [tick, setTick] = createSignal(0);

  const { dispose } = mountWithProvider(
    {
      beacon: () => {
        tick();

        return counted.beacon;
      },
    },
    () => {
      useDisruption(draftEditor());
    },
  );

  expect(counted.registrations).toEqual({ live: 1, total: 1 });

  setTick(1);

  expect(counted.registrations).toEqual({ live: 1, total: 1 });

  dispose();
});

test("useDisruption follows the provider's Beacon: it leaves the old one and joins the new one", async () => {
  const first = createWebBeacon();
  const second = createWebBeacon();
  const [beacon, setBeacon] = createSignal<WebBeacon>(first.beacon);

  const { dispose } = mountWithProvider({ beacon }, () => {
    useDisruption(
      draftEditor({
        reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
      }),
    );
  });

  first.beacon.start();
  second.beacon.start();

  await expect(first.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });

  await expect(second.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });

  setBeacon(second.beacon);

  await expect(first.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });

  await expect(second.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "blocked",
  });

  dispose();
});

test("useDisruption without a provider above it is misused", () => {
  expect(() => createRoot(() => useDisruption(draftEditor()))).toThrow(
    expect.objectContaining({
      name: "BeaconError",
      code: "INVALID_CONFIGURATION",
    }),
  );
});

test("SAFE-14 a reservation an owner held is released when the command ends, not when the owner unmounts", async () => {
  const { beacon } = createWebBeacon();
  const released = { count: 0 };
  const settling: { finish: () => void } = { finish: () => {} };

  const { dispose } = mountWithProvider({ beacon: () => beacon }, () => {
    useDisruption({
      name: "draft-editor",
      impacts: ["document-replacement"],
      reserve: () => ({
        status: "reserved",
        settle: () =>
          new Promise((resolve) => {
            settling.finish = () => resolve({ status: "ready" });
          }),
        release: () => {
          released.count += 1;
        },
      }),
    });
  });

  beacon.start();

  const command = beacon.route("web").prefetch();

  await settle();
  dispose();

  expect(released.count).toBe(0);

  settling.finish();

  await expect(command).resolves.toMatchObject({ status: "blocked" });
  expect(released.count).toBe(1);
});
