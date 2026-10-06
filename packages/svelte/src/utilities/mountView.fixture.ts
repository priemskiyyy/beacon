import { render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import type { ComponentProps } from "svelte";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredBeacon } from "../types/Register.js";
import ViewHarness from "./ViewHarness.fixture.svelte";

type MountedView<TValue> = {
  value: ReadableValue<TValue>;
  container: HTMLElement;
  unmount: () => void;
  rerender: (
    props: Partial<ComponentProps<typeof ViewHarness>>,
  ) => Promise<void>;
};

// Mounts a component that runs `use` while it initializes, under a provider of the Beacon, and lets its effects run.
export const mountView = <TValue>(
  beacon: RegisteredBeacon,
  use: () => ReadableValue<TValue>,
  { start }: { start?: boolean } = {},
): MountedView<TValue> => {
  const captured: ReadableValue<TValue>[] = [];

  const { container, unmount, rerender } = render(ViewHarness, {
    props: {
      beacon,
      start,
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

  return { value, container, unmount, rerender };
};
