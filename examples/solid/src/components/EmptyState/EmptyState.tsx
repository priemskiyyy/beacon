import type { Component } from "solid-js";

import { Icon } from "src/components/Icon/Icon";
import type { IconName } from "src/types/IconName";

type EmptyStateProps = { icon: IconName; title: string; description: string };

export const EmptyState: Component<EmptyStateProps> = (props) => (
  <div class="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center dark:border-zinc-700">
    <Icon name={props.icon} size={22} class="text-zinc-400" />
    <p class="text-base font-medium">{props.title}</p>
    <p class="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
      {props.description}
    </p>
  </div>
);
