import { createUniqueId } from "solid-js";
import type { ParentComponent } from "solid-js";

type FactProps = { term: string; hint: string };

export const Fact: ParentComponent<FactProps> = (props) => {
  const id = createUniqueId();

  return (
    <div class="flex flex-col gap-0.5 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <dt id={id} class="text-xs font-medium text-zinc-500">
        {props.term}
      </dt>
      <dd aria-labelledby={id} class="font-mono text-sm break-all">
        {props.children}
      </dd>
      <p class="text-xs text-zinc-500">{props.hint}</p>
    </div>
  );
};
