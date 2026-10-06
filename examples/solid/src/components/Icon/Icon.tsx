import clsx from "clsx";
import type { Component } from "solid-js";

import type { IconName } from "src/types/IconName";
import { ICON_PATHS } from "src/utils/constants/iconPaths";

type IconProps = { name: IconName; size: number; class?: string };

export const Icon: Component<IconProps> = (props) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width={props.size}
    height={props.size}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={clsx("shrink-0", props.class)}
  >
    <path d={ICON_PATHS[props.name]} />
  </svg>
);
