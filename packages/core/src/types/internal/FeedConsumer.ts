import type { FeedDefinition } from "src/types/internal/FeedDefinition";
import type { RouteRecord } from "src/utils/internal/routes/RouteRecord";

/** One feed route as the source it reads sees it. */
export type FeedConsumer = {
  name: string;
  definition: FeedDefinition;
  record: RouteRecord;
};
