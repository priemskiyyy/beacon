import type { IconName } from "src/types/IconName";

/** Stroke paths on a 24 by 24 grid, drawn with a round 2 unit line. */
export const ICON_PATHS: Record<IconName, string> = {
  broadcast:
    "M12 12h.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13",
  clock: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  flask: "M9 3h6M10 3v6l-5.5 10a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3",
  hourglass:
    "M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9",
  lightbulb:
    "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1zM18.5 9a4 4 0 0 1 0 6",
  notebook: "M6 3h12v18H6zM10 3v18M13 8h3M13 12h3",
  refresh: "M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5",
  route: "M6 5v9a3 3 0 0 0 3 3h6M6 5h.01M18 17h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  undo: "M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5",
};
