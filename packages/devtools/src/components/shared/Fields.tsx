import type { ParentProps } from "solid-js";

/** A list of labelled values, each a `Field`. */
export const Fields = (props: ParentProps) => (
  <dl class="fields">{props.children}</dl>
);
