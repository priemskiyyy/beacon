import type { ReadableValue } from "@priemskiyyy/beacon-svelte";

import type { SectionId } from "src/types/SectionId";
import { SECTION_IDS } from "src/utils/constants/sections";

const isSectionId = (id: string): id is SectionId =>
  SECTION_IDS.some((sectionId) => sectionId === id);

// At the bottom of the page the last section is current, even one too short to reach the watched band.
const pickSection = (crossing: Record<SectionId, boolean>) => {
  const atBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 1;

  if (atBottom) {
    return SECTION_IDS.at(-1);
  }

  return SECTION_IDS.find((id) => crossing[id]);
};

/** The section the reader is in, through `current`, for the navigation to mark. */
export const useCurrentSection = (): ReadableValue<SectionId> => {
  let current = $state<SectionId>("status");

  $effect(() => {
    const crossing: Record<SectionId, boolean> = {
      status: false,
      update: false,
      simulation: false,
      timeline: false,
    };

    const handleScroll = () => {
      const next = pickSection(crossing);

      if (next === undefined) {
        return;
      }

      current = next;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const { id } = entry.target;

          if (!isSectionId(id)) {
            continue;
          }

          crossing[id] = entry.isIntersecting;
        }

        handleScroll();
      },
      { rootMargin: "-33% 0px -62% 0px" },
    );

    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);

      if (element === null) {
        continue;
      }

      observer.observe(element);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  });

  return {
    get current() {
      return current;
    },
  };
};
