import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteHandle } from "src/types/RouteHandle";

// An overload pair, the one place a mapped type is built from names known only
// at runtime: the signature promises each name its own value, and the callers
// keep that promise by making the value of a name from that name alone.
export function mapNames<TName extends string, TValue>(
  names: TName[],
  make: (name: TName) => TValue,
): Record<TName, TValue>;

export function mapNames(
  names: string[],
  make: (name: string) => unknown,
): Record<string, unknown> {
  return Object.fromEntries(names.map((name) => [name, make(name)]));
}

// The same pair for handles, whose type depends on the route each name stands for.
export function mapHandles<TRoutes extends Record<string, RouteDefinition>>(
  entries: RouteEntry[],
  make: (entry: RouteEntry) => object,
): { [TName in keyof TRoutes & string]: RouteHandle<TName, TRoutes[TName]> };

export function mapHandles(
  entries: RouteEntry[],
  make: (entry: RouteEntry) => object,
): Record<string, object> {
  return Object.fromEntries(entries.map((entry) => [entry.name, make(entry)]));
}
