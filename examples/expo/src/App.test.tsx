import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The app as a device runs it, with fakes where the SDKs go: `expo-updates` is the fake of the adapter, `expo-application` says which build runs, and the platform is Android unless the test says another.
const launch = async ({
  updates,
  application = { applicationId: "com.example.notes", build: "120" },
  platform = "android",
}: {
  updates: ReturnType<typeof createFakeUpdates>;
  application?: { applicationId: string; build: string };
  platform?: "ios" | "android";
}) => {
  const openURL = vi.fn(async () => undefined);

  vi.resetModules();
  vi.doMock("expo-updates", () => updates);
  vi.doMock("expo-application", () => ({
    applicationId: application.applicationId,
    nativeApplicationVersion: "1.2.0",
    nativeBuildVersion: application.build,
  }));
  vi.doMock("react-native", async () => ({
    ...(await vi.importActual("react-native")),
    Platform: { OS: platform },
    Linking: { openURL },
  }));

  const { App } = await import("./App");
  const { beacon } = await import("./beacon");

  render(<App />);

  return { beacon, openURL };
};

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

test("an update on offer is a banner, and Update downloads it and reloads", async () => {
  const updates = createFakeUpdates({ available: true });

  await launch({ updates });
  await screen.findByText("A new version is ready.");
  press("Update");

  await vi.waitFor(() => expect(updates.calls.reloads).toBe(1));
  expect(updates.calls.fetches).toBe(1);
});

test("a note that is not saved blocks the update, and saving lets it through", async () => {
  const updates = createFakeUpdates({ available: true });

  await launch({ updates });
  await screen.findByText("A new version is ready.");
  fireEvent.change(screen.getByPlaceholderText("Write a note"), {
    target: { value: "Buy milk" },
  });
  press("Update");

  await screen.findByText("Save your note, then update.");
  expect(updates.calls.reloads).toBe(0);

  press("Save");
  press("Update");

  await vi.waitFor(() => expect(updates.calls.reloads).toBe(1));
});

test("a build below the minimum shows the forced upgrade, and its button opens the store", async () => {
  const updates = createFakeUpdates({ available: true });

  const { openURL } = await launch({
    updates,
    application: { applicationId: "com.example.notes", build: "119" },
  });

  await screen.findByText("This version is no longer supported.");
  expect(screen.queryByPlaceholderText("Write a note")).toBeNull();
  expect(screen.queryByText("A new version is ready.")).toBeNull();

  press("Update from the store");

  await vi.waitFor(() =>
    expect(openURL).toHaveBeenCalledWith(
      "market://details?id=com.example.notes",
    ),
  );
});

test("on iOS the same button opens the App Store page of the app", async () => {
  // The store route looks the app up in the App Store when it checks.
  vi.stubGlobal("fetch", async () => Response.json({ results: [] }));

  const { openURL } = await launch({
    updates: createFakeUpdates(),
    application: { applicationId: "com.example.notes", build: "119" },
    platform: "ios",
  });

  await screen.findByText("This version is no longer supported.");
  press("Update from the store");

  await vi.waitFor(() =>
    expect(openURL).toHaveBeenCalledWith(
      "https://apps.apple.com/app/id284882215",
    ),
  );
});

test("a build at the minimum runs the app", async () => {
  await launch({ updates: createFakeUpdates() });

  await screen.findByPlaceholderText("Write a note");
  expect(screen.queryByText("This version is no longer supported.")).toBeNull();
});

test("Expo Go, where updates are disabled and the binary is another app, says nothing", async () => {
  const { beacon } = await launch({
    updates: createFakeUpdates({ available: true, disabled: true }),
    application: { applicationId: "host.exp.Exponent", build: "1" },
  });

  await beacon.check();

  expect(beacon.route("ota").state.get().observation).toEqual({
    status: "unknown",
    reason: "unsupported-environment",
  });
  expect(beacon.support.get().status).toBe("unknown");
  expect(screen.getByPlaceholderText("Write a note")).toBeTruthy();
  expect(screen.queryByText("A new version is ready.")).toBeNull();
  expect(screen.queryByText("This version is no longer supported.")).toBeNull();
});
