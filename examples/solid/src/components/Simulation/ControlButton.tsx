import type { ParentComponent } from "solid-js";

import { buttonStyles } from "example-shared/ui/styles/buttonStyles";

type ControlButtonProps = {
  onPress: () => void;
  pressed?: boolean;
  disabled?: boolean;
};

/** A toggle when `pressed` is given, and a plain action otherwise. */
export const ControlButton: ParentComponent<ControlButtonProps> = (props) => (
  <button
    type="button"
    aria-pressed={props.pressed}
    disabled={props.disabled === true}
    onClick={props.onPress}
    class={buttonStyles({ size: "small", pressed: props.pressed === true })}
  >
    {props.children}
  </button>
);
