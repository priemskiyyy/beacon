import type { Component } from "solid-js";

import { iconTileStyles } from "example-shared/ui/styles/iconTileStyles";
import { Icon } from "src/components/Icon/Icon";
import type { IconName } from "src/types/IconName";

type IconTileProps = { icon: IconName; size: "regular" | "small" };

const ICON_SIZES: Record<IconTileProps["size"], number> = {
  regular: 20,
  small: 16,
};

export const IconTile: Component<IconTileProps> = (props) => (
  <span aria-hidden="true" class={iconTileStyles({ size: props.size })}>
    <Icon name={props.icon} size={ICON_SIZES[props.size]} />
  </span>
);
