import type React from "react";
import type { ReactNode } from "react";

type ControlGroupProps = { label: string; children: ReactNode };

export const ControlGroup: React.FunctionComponent<ControlGroupProps> = ({
  label,
  children,
}) => (
  <div role="group" aria-label={label} className="flex flex-col gap-2">
    <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
      {label}
    </h4>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);
