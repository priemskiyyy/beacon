import type { ForegroundWindowLike } from "src/browser/types/ForegroundWindowLike";
import { getGlobalWindow } from "src/browser/utils/getGlobalWindow";
import type { BeaconTrigger } from "src/types/BeaconTrigger";
import { signalReturn } from "src/utils/signalReturn";

/**
 * Checks when the page comes back: its tab is shown again, or the browser
 * restores it from the back-forward cache. A return is seen from a hidden
 * document, so a page that was never hidden checks nothing, and a page that
 * loads hidden checks when it is first shown. With `minAway`, a return after
 * less than that many milliseconds is skipped, and one whose departure was not
 * seen never is. It listens to the document's `visibilitychange` and the
 * window's `pageshow`, and tells the gate where the page is, so that
 * `interval` pauses while the tab is hidden, where a browser throttles its
 * timers. It listens to the global `window`, reached when a session opens, or
 * to `target`; in a server render there is none, and it installs nothing.
 *
 * @example
 * ```ts
 * import { checkOn } from "@priemskiyyy/beacon-triggers";
 * import { foreground } from "@priemskiyyy/beacon-triggers/browser";
 *
 * checkOn(beacon, { triggers: [foreground({ minAway: 30_000 })] });
 * ```
 */
export const foreground =
  ({
    target,
    minAway = 0,
  }: { target?: ForegroundWindowLike; minAway?: number } = {}): BeaconTrigger =>
  (trigger) => {
    // The real window fits the structural type: `browser.contracts.ts` proves it.
    const host: ForegroundWindowLike | null = target ?? getGlobalWindow();

    if (host === null) {
      return () => {};
    }

    const { document } = host;
    let away = document.visibilityState === "hidden";
    // When the page was seen leaving, or `null` when it loaded hidden or was restored without a departure seen.
    let leftAt: number | null = null;

    trigger.setAway(away);

    const comeBack = () => {
      const observedAway =
        leftAt === null ? null : trigger.clock.now() - leftAt;

      away = false;
      leftAt = null;
      signalReturn(trigger, observedAway, minAway);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!away) {
          leftAt = trigger.clock.now();
        }

        away = true;
        trigger.setAway(true);

        return;
      }

      if (!away) {
        return;
      }

      comeBack();
    };

    // A page restored from the cache may not have seen itself hidden, and is a return all the same.
    const onPageShow = (event: { persisted: boolean }) => {
      if (!event.persisted) {
        return;
      }

      comeBack();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    host.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      host.removeEventListener("pageshow", onPageShow);
    };
  };
