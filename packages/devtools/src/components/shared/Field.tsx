import type { ParentProps } from "solid-js";

type FieldProps = ParentProps<{ label: string }>;

/** One labelled value. */
export const Field = (props: FieldProps) => (
  <div class="field">
    <dt>{props.label}</dt>
    <dd>{props.children}</dd>
  </div>
);
