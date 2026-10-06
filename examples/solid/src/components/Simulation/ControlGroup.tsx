import type { ParentComponent } from "solid-js";

type ControlGroupProps = { label: string };

export const ControlGroup: ParentComponent<ControlGroupProps> = (props) => (
  <div role="group" aria-label={props.label} class="flex flex-col gap-2">
    <h4 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
      {props.label}
    </h4>
    <div class="flex flex-wrap gap-2">{props.children}</div>
  </div>
);
