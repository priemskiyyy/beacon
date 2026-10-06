import clsx from "clsx";
import { children, Show } from "solid-js";
import type { JSX, ParentComponent } from "solid-js";

import { CARD_CLASS_NAME } from "example-shared/ui/styles/cardStyles";
import { IconTile } from "src/components/IconTile/IconTile";
import type { IconName } from "src/types/IconName";

type PanelProps = {
  title: string;
  icon: IconName;
  shows: string;
  aside?: JSX.Element;
};

export const Panel: ParentComponent<PanelProps> = (props) => {
  // Reading a JSX prop twice would build its elements twice, so it is resolved once.
  const aside = children(() => props.aside);

  return (
    <section
      aria-label={props.title}
      class={clsx("flex h-full min-w-0 flex-col gap-4 p-5", CARD_CLASS_NAME)}
    >
      <header class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <IconTile icon={props.icon} size="small" />
          <h3 class="text-base font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
            {props.title}
          </h3>
          <Show when={aside.toArray().length > 0}>
            <div class="ml-auto flex flex-wrap items-center gap-2">
              {aside()}
            </div>
          </Show>
        </div>
        <p class="text-sm text-zinc-500 dark:text-zinc-400">{props.shows}</p>
      </header>
      {props.children}
    </section>
  );
};
