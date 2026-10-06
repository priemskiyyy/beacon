import type { ManifestFetch } from "src/types/ManifestFetch";
import type { ManifestLimits } from "src/types/ManifestLimits";
import type { RouteDeclarations } from "src/types/RouteDeclarations";

/**
 * Options for `standardManifestSource()`. `url` is where the manifest is
 * served and `routes` declares what the application reads from it, as for
 * `readStandardManifest`. `fetch` is the client that makes the request, the
 * global `fetch` by default: pass your own for a test, an authenticated
 * client or a platform that needs a wrapper. `headers` are sent with every
 * request, such as an authorization header; the validator is sent by the
 * source. `name` labels the source in diagnostics and evidence, `manifest` by
 * default, and `limits` tunes what a manifest may be, which the defaults
 * already bound.
 *
 * @example
 * ```ts
 * const options: StandardManifestSourceOptions<{ web: { kind: "target" } }> = {
 *   url: "/releases.json",
 *   routes: { web: { kind: "target" } },
 *   headers: { "x-client": "notes-web" },
 * };
 * ```
 */
export type StandardManifestSourceOptions<
  TDeclarations extends RouteDeclarations,
> = {
  url: string;
  routes: TDeclarations;
  fetch?: ManifestFetch;
  headers?: Record<string, string>;
  name?: string;
  limits?: Partial<ManifestLimits>;
};
