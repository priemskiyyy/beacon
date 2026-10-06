import { Flask, Megaphone } from "@phosphor-icons/react";
import type React from "react";

import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import { HeroStep } from "src/components/Hero/HeroStep";
import { scrollToElement } from "src/utils/scrollToElement";

export const Hero: React.FunctionComponent = () => (
  <section
    aria-label="Overview"
    className="grid gap-6 rounded-3xl border border-rose-200 bg-linear-to-br from-rose-50 via-rose-50/70 to-sky-50/60 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center dark:border-rose-900/60 dark:from-rose-950/30 dark:via-zinc-950 dark:to-sky-950/20"
  >
    <div className="flex flex-col gap-4">
      <p className="font-mono text-sm font-semibold tracking-widest text-rose-700 uppercase dark:text-rose-300">
        A Beacon demo
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        What this page knows about its own release
      </h2>
      <p className="max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
        One Beacon holds the build this page runs, what a scripted release
        service wants, and a request to reload. Nothing leaves your browser: you
        publish, break and expire the service yourself, and the timeline shows
        what Beacon concluded, and what it refused to claim.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => scrollToElement("simulation")}
          className={buttonStyles({ variant: "primary" })}
        >
          <Flask aria-hidden="true" size={16} weight="bold" />
          Open the simulation
        </button>
        <button
          type="button"
          onClick={() => scrollToElement("update")}
          className={buttonStyles({ variant: "ghost" })}
        >
          <Megaphone aria-hidden="true" size={16} weight="bold" />
          See the update banner
        </button>
      </div>
    </div>
    <ol aria-label="How to use this page" className="flex flex-col gap-2.5">
      <HeroStep
        number={1}
        title="Publish"
        description="Script the release service: name a newer build, require one, or roll the deployment back."
      />
      <HeroStep
        number={2}
        title="Notice"
        description="Check. The offer, the support verdict and the evidence behind them appear, and a failing check keeps what was accepted."
      />
      <HeroStep
        number={3}
        title="Update"
        description="Ask for a reload, then boot the next document. The journal says whether it runs the build you aimed at."
      />
    </ol>
  </section>
);
