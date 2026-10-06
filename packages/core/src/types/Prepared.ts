import type { PreparedReference } from "src/types/PreparedReference";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Something the provider reports as ready for a later step, such as a
 * downloaded bundle or an activated worker. It says nothing about the running
 * code: only a later boot can show that. A command that needs a prepared
 * target takes this object, and reads the `ref` inside it.
 *
 * @example
 * ```ts
 * const { prepared } = beacon.route("ota").state.get();
 *
 * if (prepared.status === "ready") {
 *   console.info(prepared.value.release.label);
 * }
 * ```
 */
export type Prepared<TRoute extends string, TBody extends RouteBody> = {
  ref: PreparedReference<TRoute>;
} & TBody;
