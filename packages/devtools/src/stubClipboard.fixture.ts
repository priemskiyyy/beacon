/** Gives jsdom a clipboard that records what is written to it, and a way to take it away again. */
export const stubClipboard = () => {
  const writes: string[] = [];

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        writes.push(text);
      },
    },
  });

  return {
    writes,
    restore: () => {
      Reflect.deleteProperty(navigator, "clipboard");
    },
  };
};
