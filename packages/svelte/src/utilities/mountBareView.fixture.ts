import { render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import type { ReadableValue } from "../types/ReadableValue.js";
import View from "./View.fixture.svelte";

// Mounts a component that runs `use` while it initializes, with no provider above it, and lets its effects run.
export const mountBareView = <TValue>(
  use: () => ReadableValue<TValue>,
): { value: ReadableValue<TValue>; unmount: () => void } => {
  const captured: ReadableValue<TValue>[] = [];

  const { unmount } = render(View, {
    props: {
      read: () => {
        captured.push(use());
      },
    },
  });

  flushSync();

  const [value] = captured;

  if (value === undefined) {
    throw new Error("The view did not run the utility.");
  }

  return { value, unmount };
};
