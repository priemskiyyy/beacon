// The testing story from the packages alone: an Expo app's Jest (`jest-expo`), with
// the documented `transformIgnorePatterns`, runs tests that import the core's mock
// entry and the Expo package's `createFakeUpdates`, through the React provider.
export const JEST_PACKAGES = [
  "@priemskiyyy/beacon",
  "@priemskiyyy/beacon-react",
  "@priemskiyyy/beacon-expo",
];

export const jestFiles = {
  // The configuration the testing page shows, word for word.
  "jest.config.cjs": `const preset = require("jest-expo/jest-preset");

module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    preset.transformIgnorePatterns[0].replace("(?!(", "(?!(@priemskiyyy|"),
    ...preset.transformIgnorePatterns.slice(1),
  ],
};
`,

  "src/updates.test.tsx": `import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { applyUpdate, expoUpdates } from "@priemskiyyy/beacon-expo";
import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
import { BeaconProvider, useRoute } from "@priemskiyyy/beacon-react";
import { Text } from "react-native";
import { act, create } from "react-test-renderer";

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "android",
  distribution: "google-play",
};

const createBeacon = (updates) =>
  new Beacon({
    scope,
    routes: { ota: expoUpdates({ updates }) },
    clock: createTestClock(),
  });

const Status = () => {
  const status = useRoute("ota", (snapshot) => snapshot.observation.status);

  return <Text>{status}</Text>;
};

test("an update is checked, downloaded and then restarted with what was prepared", async () => {
  const updates = createFakeUpdates({ available: true });
  const beacon = createBeacon(updates);

  beacon.start();
  await beacon.check();

  expect(beacon.route("ota").state.get().observation.status).toBe("available");

  const applied = await applyUpdate(beacon.route("ota"));

  expect(applied).toMatchObject({
    step: "reload",
    outcome: { status: "accepted" },
    download: { status: "accepted", receipt: { offered: "same" } },
  });
  expect(updates.calls).toEqual({ checks: 1, fetches: 1, reloads: 1 });
  beacon.dispose();
});

test("the provider renders what the route observed", async () => {
  const beacon = createBeacon(createFakeUpdates({ available: true }));
  let tree;

  await act(async () => {
    tree = create(
      <BeaconProvider beacon={beacon}>
        <Status />
      </BeaconProvider>,
    );
  });

  expect(tree.root.findByType(Text).props.children).toBe("unknown");

  await act(async () => {
    await beacon.check();
  });

  expect(tree.root.findByType(Text).props.children).toBe("available");

  await act(async () => {
    tree.unmount();
  });
  beacon.dispose();
});

test("a Beacon whose provider is disabled reports unknown and never none", async () => {
  const beacon = createBeacon(createFakeUpdates({ disabled: true }));

  beacon.start();
  await beacon.check();

  expect(beacon.route("ota").state.get().observation.status).toBe("unknown");
  beacon.dispose();
});

test("the conformance suites need the test runner they register with", () => {
  expect(() => require("@priemskiyyy/beacon/testing")).toThrow(/vitest/);
});
`,
};
