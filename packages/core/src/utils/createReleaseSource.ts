import type { ReleaseSource } from "src/types/ReleaseSource";
import type { ReleaseSourceOptions } from "src/types/ReleaseSourceOptions";

/**
 * Makes a source of your own from a name and a `read`. Sources that share one
 * object share one read, so keep one source per authority and `select` a view
 * of it for each route.
 *
 * @example
 * ```ts
 * const decisions = createReleaseSource({ name: "internal-release-api", read });
 * const web = decisions.select((decision) => decision.web);
 * ```
 */
export const createReleaseSource = <TDocument>({
  name,
  read,
}: ReleaseSourceOptions<TDocument>): ReleaseSource<TDocument> => {
  const source: ReleaseSource<TDocument> = {
    name,
    read,
    select: (project) => ({ source, project }),
  };

  return Object.freeze(source);
};
