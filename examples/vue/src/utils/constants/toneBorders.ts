import type { Tone } from "example-shared/ui/types/Tone";

export const TONE_BORDERS: Record<Tone, string> = {
  neutral: "border-zinc-300 dark:border-zinc-700",
  positive: "border-emerald-300 dark:border-emerald-900",
  warning: "border-yellow-300 dark:border-yellow-900",
  danger: "border-red-300 dark:border-red-900",
  accent: "border-rose-300 dark:border-rose-800",
  info: "border-sky-300 dark:border-sky-900",
};
