import type { ParentComponent } from "solid-js";

import { Icon } from "src/components/Icon/Icon";
import type { SectionId } from "src/types/SectionId";
import { SECTIONS } from "src/utils/constants/sections";

type SectionProps = { id: SectionId; hint: string };

export const Section: ParentComponent<SectionProps> = (props) => (
  <section
    id={props.id}
    aria-labelledby={`${props.id}-title`}
    class="flex scroll-mt-32 flex-col gap-4"
  >
    <header class="flex flex-col gap-2">
      <div class="flex items-center gap-3">
        <span
          aria-hidden="true"
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-600 font-mono text-base font-semibold text-white tabular-nums dark:bg-rose-400 dark:text-zinc-950"
        >
          {SECTIONS[props.id].number}
        </span>
        <h2
          id={`${props.id}-title`}
          class="text-xl font-semibold tracking-tight sm:text-2xl"
        >
          {SECTIONS[props.id].title}
        </h2>
      </div>
      <p class="flex max-w-4xl items-start gap-2 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
        <Icon
          name="lightbulb"
          size={20}
          class="mt-0.5 text-rose-600 dark:text-rose-400"
        />
        <span>
          <span class="font-semibold text-zinc-800 dark:text-zinc-200">
            Try this:
          </span>{" "}
          {props.hint}
        </span>
      </p>
    </header>
    {props.children}
  </section>
);
