import type { ParentProps } from "solid-js";

type StateBadgeProps = ParentProps<{ state: string }>;

/** A pill with a dot, coloured by a state name. */
export const StateBadge = (props: StateBadgeProps) => (
  <span class="status" data-state={props.state}>
    <span class="dot" data-state={props.state} />
    {props.children}
  </span>
);
