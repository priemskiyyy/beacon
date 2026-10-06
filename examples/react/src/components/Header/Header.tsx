import { ArrowCounterClockwise, Broadcast } from "@phosphor-icons/react";
import { useObservable, useStatus } from "@priemskiyyy/beacon-react";
import type React from "react";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { SESSION_TONES } from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import { Badge } from "src/components/Badge/Badge";
import { IconTile } from "src/components/IconTile/IconTile";
import { SectionNav } from "src/components/Section/SectionNav";

type HeaderProps = { lab: ReleaseLab };

export const Header: React.FunctionComponent<HeaderProps> = ({ lab }) => {
  const { state } = useStatus();
  const { number } = useObservable(lab.boot);

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
          <IconTile icon={Broadcast} size="small" />
          <h1 className="text-lg font-semibold">Release lab</h1>
          <Badge tone={SESSION_TONES[state]}>session {state}</Badge>
          <Badge tone="neutral">document {number}</Badge>
        </div>
        <div className="order-last w-full min-w-0 lg:order-none lg:w-auto">
          <SectionNav />
        </div>
        <button
          type="button"
          onClick={lab.controls.reset}
          className={buttonStyles({ variant: "ghost", size: "small" })}
        >
          <ArrowCounterClockwise aria-hidden="true" size={14} weight="bold" />
          Reset demo
        </button>
      </div>
    </header>
  );
};
