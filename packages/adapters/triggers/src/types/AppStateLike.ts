/**
 * The part of React Native's `AppState` the `foreground` trigger uses. Pass
 * the module itself: `import { AppState } from "react-native"`. The package
 * never imports it, so a test passes a fake and a server render loads nothing.
 *
 * @example
 * ```ts
 * import { AppState } from "react-native";
 *
 * const returns = foreground({ appState: AppState });
 * ```
 */
export type AppStateLike = {
  /** The latest state React Native knows, such as `active` or `background`; it is `null` until the module resolves it. */
  currentState: string | null | undefined;
  addEventListener(
    type: "change",
    listener: (state: string) => void,
  ): { remove(): void };
};
