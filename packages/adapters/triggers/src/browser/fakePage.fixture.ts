import type { ForegroundWindowLike } from "src/browser/types/ForegroundWindowLike";
import type { ReconnectWindowLike } from "src/browser/types/ReconnectWindowLike";

type Listener = (event: { persisted: boolean }) => void;

// A page driven by hand: the document says whether it is visible and tells `visibilitychange`, and the window tells `pageshow` and `online`. Like the real one, the document updates its state before it tells a listener.
export const fakePage = (visibilityState = "visible") => {
  const visibility = new Set<() => void>();
  const pageshow = new Set<Listener>();
  const online = new Set<Listener>();

  const target: ForegroundWindowLike & ReconnectWindowLike = {
    document: {
      visibilityState,
      addEventListener: (_type, listener) => {
        visibility.add(listener);
      },
      removeEventListener: (_type, listener) => {
        visibility.delete(listener);
      },
    },
    addEventListener: (type: string, listener: Listener) => {
      if (type === "pageshow") {
        pageshow.add(listener);

        return;
      }

      online.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      if (type === "pageshow") {
        pageshow.delete(listener);

        return;
      }

      online.delete(listener);
    },
  };

  const setVisibility = (next: string) => {
    target.document.visibilityState = next;

    for (const listener of [...visibility]) {
      listener();
    }
  };

  return {
    target,
    hide: () => setVisibility("hidden"),
    show: () => setVisibility("visible"),
    restore: (persisted: boolean) => {
      for (const listener of [...pageshow]) {
        listener({ persisted });
      }
    },
    comeOnline: () => {
      for (const listener of [...online]) {
        listener({ persisted: false });
      }
    },
    listeners: () => ({
      visibility: visibility.size,
      pageshow: pageshow.size,
      online: online.size,
    }),
  };
};
