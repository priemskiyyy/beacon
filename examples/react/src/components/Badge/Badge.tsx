import type React from "react";
import type { ReactNode } from "react";

import { badgeStyles } from "example-shared/ui/styles/badgeStyles";
import { dotStyles } from "example-shared/ui/styles/dotStyles";
import type { Tone } from "example-shared/ui/types/Tone";

type BadgeProps = { tone: Tone; dot?: boolean; children: ReactNode };

/** A state as a badge; `dot` adds the light that marks a state that is live. */
export const Badge: React.FunctionComponent<BadgeProps> = ({
  tone,
  dot = false,
  children,
}) => (
  <span className={badgeStyles({ tone })}>
    {dot ? <span aria-hidden="true" className={dotStyles({ tone })} /> : null}
    {children}
  </span>
);
