import type { FakeUpdates } from "src/mock/types/FakeUpdates";
import type { FakeUpdatesOptions } from "src/mock/types/FakeUpdatesOptions";
import { FAKE_EMBEDDED_ID, FAKE_UPDATE_ID } from "src/utils/constants/fakes";

// What `expo-updates` rejects with where updates are off, and which the adapter reads as an environment that cannot update.
const refuse = () =>
  Object.assign(new Error("Updates are disabled in this build."), {
    code: "ERR_UPDATES_DISABLED",
  });

/**
 * A fake `expo-updates` module, for the screens of an application and the
 * tests of one: pass it as `updates` where the real module goes, in a
 * development build or Expo Go to see the banner, or under Jest to drive it.
 * With `available`, the server has one update for the build, which a check
 * offers and a fetch downloads, every time. With `disabled`, updates are off,
 * as in Expo Go: nothing runs from an update and each call is refused the way
 * the SDK refuses it. Nothing is ever reloaded. `calls` counts what it was
 * asked, and a method assigned over it is what the route meets, which is how a
 * test scripts a failure or a slow fetch.
 *
 * @example
 * ```ts
 * import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
 * import * as Updates from "expo-updates";
 *
 * const routes = {
 *   ota: expoUpdates({
 *     updates: __DEV__ ? createFakeUpdates({ available: true }) : Updates,
 *   }),
 * };
 * ```
 */
export const createFakeUpdates = ({
  available = false,
  disabled = false,
}: FakeUpdatesOptions = {}): FakeUpdates => {
  const calls = { checks: 0, fetches: 0, reloads: 0 };

  return {
    calls,
    isEnabled: !disabled,
    updateId: disabled ? null : FAKE_EMBEDDED_ID,
    channel: disabled ? null : "production",
    runtimeVersion: disabled ? null : "1.0.0",
    isEmbeddedLaunch: !disabled,
    isEmergencyLaunch: false,
    checkForUpdateAsync: async () => {
      calls.checks += 1;

      if (disabled) {
        throw refuse();
      }

      if (!available) {
        return {
          isAvailable: false,
          isRollBackToEmbedded: false,
          manifest: undefined,
          reason: "noUpdateAvailableOnServer",
        };
      }

      return {
        isAvailable: true,
        isRollBackToEmbedded: false,
        manifest: { id: FAKE_UPDATE_ID },
        reason: undefined,
      };
    },
    fetchUpdateAsync: async () => {
      calls.fetches += 1;

      if (disabled) {
        throw refuse();
      }

      if (!available) {
        return {
          isNew: false,
          isRollBackToEmbedded: false,
          manifest: undefined,
        };
      }

      return {
        isNew: true,
        isRollBackToEmbedded: false,
        manifest: { id: FAKE_UPDATE_ID },
      };
    },
    reloadAsync: async () => {
      calls.reloads += 1;

      if (!disabled) {
        return;
      }

      throw refuse();
    },
  };
};
