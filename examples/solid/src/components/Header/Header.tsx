import { useObservable, useBeaconStatus } from "@priemskiyyy/beacon-solid";
import type { Component } from "solid-js";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { SESSION_TONES } from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import { Badge } from "src/components/Badge/Badge";
import { Icon } from "src/components/Icon/Icon";
import { IconTile } from "src/components/IconTile/IconTile";
import { SectionNav } from "src/components/Section/SectionNav";

type HeaderProps = { lab: ReleaseLab };

export const Header: Component<HeaderProps> = (props) => {
  const status = useBeaconStatus();
  const number = useObservable(props.lab.boot, (boot) => boot.number);

  return (
    <header class="sticky top-0 z-20 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div class="mr-auto flex min-w-0 flex-wrap items-center gap-2">
          <IconTile icon="broadcast" size="small" />
          <h1 class="text-lg font-semibold">Release lab</h1>
          <Badge tone={SESSION_TONES[status().state]} dot>
            session {status().state}
          </Badge>
          <Badge tone="neutral">document {number()}</Badge>
        </div>
        <div class="order-last w-full min-w-0 lg:order-none lg:w-auto">
          <SectionNav />
        </div>
        <button
          type="button"
          onClick={props.lab.controls.reset}
          class={buttonStyles({ variant: "ghost", size: "small" })}
        >
          <Icon name="undo" size={14} />
          Reset demo
        </button>
      </div>
    </header>
  );
};
