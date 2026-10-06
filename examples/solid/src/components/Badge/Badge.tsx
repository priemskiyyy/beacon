import { Show } from "solid-js";
import type { ParentComponent } from "solid-js";

import { badgeStyles } from "example-shared/ui/styles/badgeStyles";
import { dotStyles } from "example-shared/ui/styles/dotStyles";
import type { Tone } from "example-shared/ui/types/Tone";

type BadgeProps = { tone: Tone; dot?: boolean };

/** A state as a badge; `dot` adds the light that marks a state that is live. */
export const Badge: ParentComponent<BadgeProps> = (props) => (
  <span class={badgeStyles({ tone: props.tone })}>
    <Show when={props.dot === true}>
      <span aria-hidden="true" class={dotStyles({ tone: props.tone })} />
    </Show>
    {props.children}
  </span>
);
