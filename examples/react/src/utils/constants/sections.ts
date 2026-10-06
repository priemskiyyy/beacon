import type { Section } from "src/types/Section";
import type { SectionId } from "src/types/SectionId";

export const SECTIONS: Record<SectionId, Section> = {
  status: {
    number: 1,
    title: "What this document knows, and no more",
    label: "Status",
  },
  update: { number: 2, title: "The update offer", label: "Offer" },
  simulation: { number: 3, title: "Script the world", label: "Simulation" },
  timeline: { number: 4, title: "Watch it happen", label: "Timeline" },
};

export const SECTION_IDS: SectionId[] = [
  "status",
  "update",
  "simulation",
  "timeline",
];
