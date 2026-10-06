import { createSignal } from "solid-js";

import type { Preferences } from "src/types/internal/Preferences";
import { PREFERENCES_KEY } from "src/utils/constants/defaults";
import { parsePreferences } from "src/utils/parsePreferences";

// What is stored is a stranger's text: blocked, absent, corrupt or written by another version, it is the defaults.
const readPreferences = (): Preferences => {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);

    if (stored === null) {
      return {};
    }

    return parsePreferences(JSON.parse(stored));
  } catch {
    return {};
  }
};

/**
 * The panel's preferences as a signal, backed by `localStorage`. A choice
 * lives on in memory for this page even where storage refuses it (a private
 * window, a full quota), and is dropped from storage without a word.
 */
export const usePreferences = () => {
  const [preferences, setPreferences] = createSignal(readPreferences());

  const update = (patch: Preferences) => {
    const next = { ...preferences(), ...patch };

    setPreferences(next);

    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  };

  return { preferences, update };
};
