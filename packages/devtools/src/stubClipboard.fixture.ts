/** Gives jsdom a clipboard that records what is written to it, refuses every write as a browser does without permission, or holds each write until `release()`, and a way to take it away again. */
export const stubClipboard = ({
  isRefusing = false,
  isHeld = false,
}: { isRefusing?: boolean; isHeld?: boolean } = {}) => {
  const writes: string[] = [];
  const held: Array<() => void> = [];

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        if (isHeld) {
          await new Promise<void>((resolve) => {
            held.push(resolve);
          });
        }

        if (isRefusing) {
          throw new DOMException("Write permission denied.", "NotAllowedError");
        }

        writes.push(text);
      },
    },
  });

  return {
    writes,
    /** Lets the oldest held write settle. */
    release: () => held.shift()?.(),
    restore: () => {
      Reflect.deleteProperty(navigator, "clipboard");
    },
  };
};
