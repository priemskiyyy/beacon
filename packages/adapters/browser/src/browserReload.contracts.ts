// Typechecked, never run: the real DOM window satisfies the structural type
// the adapter uses, and a route's methods are derived from the commands the
// mechanism declares.
import { createReleaseSource, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  OfferReference,
  RouteHandle,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { browserReload } from "src/browserReload";
import type { BrowserNative } from "src/types/BrowserNative";
import type { BrowserWindowLike } from "src/types/BrowserWindowLike";

export const target: BrowserWindowLike = window;

export const mechanism = browserReload({ target: window });

// @ts-expect-error -- an object without a location is not a window.
browserReload({ target: { navigator: {} } });

const manifest = createReleaseSource<{ web: TargetDecision | NoneDecision }>({
  name: "manifest",
  read: async () => {
    throw new Error("Never run.");
  },
});

export const routes = {
  web: targetRoute({
    subject: "web",
    source: manifest.select((document) => document.web),
    mechanism,
  }),
};

declare const web: RouteHandle<"web", typeof routes.web>;

declare const offer: OfferReference<"web">;

export const outcome = web.requestReload({ offer });

// @ts-expect-error -- a reload needs the offer the user was shown.
web.requestReload();

// WEB-07 A hard reload is not an option of the reload command, so no portable guarantee of one is made.
// @ts-expect-error -- there is no hard reload.
web.requestReload({ offer, hard: true });

// @ts-expect-error -- a prepared reference never fits where an offer is asked for.
web.requestReload({ prepared: { kind: "prepared", route: "web", id: 1 } });

// BIND-05 The native handle of a typed route is the provider's own type, without an assertion.
expectTypeOf(web.native.get()).toEqualTypeOf<BrowserNative | null>();

export const receipt = async () => {
  const settled = await web.requestReload({ offer });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<{ kind: "reload-requested" }>();

    // @ts-expect-error -- an accepted reload proves no update.
    return settled.receipt.updated;
  }

  return null;
};
