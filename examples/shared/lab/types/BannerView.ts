import type { Tone } from "example-shared/ui/types/Tone";

/** What the update banner says, apart from how a framework draws it. */
export type BannerView = { tone: Tone; headline: string; detail: string };
