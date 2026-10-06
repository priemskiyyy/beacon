import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * What an offer carries besides the release, which CodePush names by the hash
 * of the package. `label` is the server's own (`v12`), or `null` when it gave
 * none. `failedInstall` says this device installed the package before and
 * rolled it back, and then `download` is refused. The deployment key is not
 * here: it names the app's deployment, and no Beacon state carries it.
 *
 * @example
 * ```ts
 * const offer: CodePushOffer = { release, label: "v12", mandatory: false, failedInstall: false };
 * ```
 */
export type CodePushOffer = RouteBody & {
  label: string | null;
  mandatory: boolean;
  failedInstall: boolean;
};
