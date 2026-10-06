import type { CheckOptions } from "src/types/CheckOptions";
import type { CheckOutcome } from "src/types/CheckOutcome";
import type { CommandFacade } from "src/types/CommandFacade";
import type { CommandsOfRoute } from "src/types/internal/CommandsOfRoute";
import type { NativeOf } from "src/types/internal/NativeOf";
import type { ObservableValue } from "src/types/ObservableValue";
import type { RouteCapabilities } from "src/types/RouteCapabilities";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteSnapshotOf } from "src/types/RouteSnapshotOf";

/**
 * The stable handle of one route: its snapshot, its native handle, what its
 * commands declare, its own check, and one method per command with the input
 * and receipt that command declares. Acquiring or observing it is passive.
 *
 * @example
 * ```ts
 * const web = beacon.route("web");
 * const { observation } = web.state.get();
 *
 * if (observation.status === "available") {
 *   await web.reload({ offer: observation.offer });
 * }
 * ```
 */
export type RouteHandle<
  TName extends string,
  TDefinition extends RouteDefinition,
> = {
  state: ObservableValue<RouteSnapshotOf<TName, TDefinition>>;
  /** The provider handle of the open session, or `null` while none is open. Calling it directly bypasses Beacon's admission and journal. */
  native: ObservableValue<NativeOf<TDefinition> | null>;
  capabilities: RouteCapabilities<CommandsOfRoute<TDefinition>>;
  check(options?: CheckOptions): Promise<CheckOutcome>;
  /**
   * Ends what a command left unresolved: its reservations are released and
   * the route accepts commands again. It claims nothing about what the provider
   * did, so call it once the application has decided to continue in this
   * runtime. A route with nothing unresolved is left alone.
   */
  acknowledge(): void;
} & CommandFacade<TName, CommandsOfRoute<TDefinition>>;
