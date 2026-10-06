import { For } from "solid-js";
import type { Component } from "solid-js";

import { navLinkStyles } from "example-shared/ui/styles/navLinkStyles";
import { useCurrentSection } from "src/hooks/useCurrentSection";
import { SECTION_IDS, SECTIONS } from "src/utils/constants/sections";
import { scrollToElement } from "src/utils/scrollToElement";

export const SectionNav: Component = () => {
  const current = useCurrentSection();

  return (
    <nav aria-label="Explore the lab" class="flex gap-1 overflow-x-auto py-1">
      <For each={SECTION_IDS}>
        {(id) => (
          <button
            type="button"
            aria-current={current() === id ? "location" : undefined}
            onClick={() => scrollToElement(id)}
            class={navLinkStyles({ current: current() === id })}
          >
            {SECTIONS[id].label}
          </button>
        )}
      </For>
    </nav>
  );
};
