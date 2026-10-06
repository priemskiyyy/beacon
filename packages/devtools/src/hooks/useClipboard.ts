import { createSignal, onCleanup } from "solid-js";

import { COPY_FEEDBACK } from "src/utils/constants/defaults";

/** Copies text and reports success briefly. An insecure origin has no clipboard, so copying does nothing there. */
export const useClipboard = () => {
  const [hasCopied, setHasCopied] = createSignal(false);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let isGone = false;

  onCleanup(() => {
    isGone = true;
    clearTimeout(timer);
  });

  const copy = (text: string) => {
    const { clipboard } = navigator;

    if (clipboard === undefined) {
      return;
    }

    clipboard.writeText(text).then(
      () => {
        // The browser may settle a write after the button went, and no timer may outlive it.
        if (isGone) {
          return;
        }

        setHasCopied(true);
        clearTimeout(timer);
        timer = setTimeout(() => setHasCopied(false), COPY_FEEDBACK);
      },
      () => {},
    );
  };

  return { hasCopied, copy };
};
