import type React from "react";
import type { ReactNode } from "react";

import { buttonStyles } from "example-shared/ui/styles/buttonStyles";

type ControlButtonProps = {
  onPress: () => void;
  pressed?: boolean;
  disabled?: boolean;
  children: ReactNode;
};

/** A toggle when `pressed` is given, and a plain action otherwise. */
export const ControlButton: React.FunctionComponent<ControlButtonProps> = ({
  onPress,
  pressed,
  disabled = false,
  children,
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onPress}
    className={buttonStyles({ size: "small", pressed: pressed === true })}
  >
    {children}
  </button>
);
