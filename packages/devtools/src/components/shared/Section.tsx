import type { ParentProps } from "solid-js";

type SectionProps = ParentProps<{ title: string }>;

/** A titled block of the detail area. */
export const Section = (props: SectionProps) => (
  <section class="section" aria-label={props.title}>
    <h3>{props.title}</h3>
    {props.children}
  </section>
);
