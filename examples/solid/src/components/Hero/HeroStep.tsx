import type { Component } from "solid-js";

type HeroStepProps = { number: number; title: string; description: string };

export const HeroStep: Component<HeroStepProps> = (props) => (
  <li class="flex gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-rose-200/70 dark:bg-zinc-900/70 dark:ring-rose-900/50">
    <span
      aria-hidden="true"
      class="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-600 font-mono text-sm font-semibold text-white dark:bg-rose-400 dark:text-zinc-950"
    >
      {props.number}
    </span>
    <span class="flex flex-col gap-0.5">
      <span class="font-semibold">{props.title}</span>
      <span class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {props.description}
      </span>
    </span>
  </li>
);
