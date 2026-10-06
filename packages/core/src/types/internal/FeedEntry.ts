import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { FeedRecord } from "src/utils/internal/feeds/FeedRecord";

/** One source and every feed route that reads it, so one accepted document reaches all of them together. */
export type FeedEntry = {
  record: FeedRecord;
  consumers: RouteEntry[];
};
