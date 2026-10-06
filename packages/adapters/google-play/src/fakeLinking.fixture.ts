import type { LinkingLike } from "src/types/LinkingLike";

// A link opener that records every URL it was asked to open, and refuses the ones a test names, as `Linking.openURL` does where nothing handles a scheme.
export const fakeLinking = (refused: string[] = []) => {
  const asked: string[] = [];

  const linking: LinkingLike = {
    openURL: async (url) => {
      asked.push(url);

      if (!refused.some((prefix) => url.startsWith(prefix))) {
        return;
      }

      throw new Error(`Could not open URL '${url}'`);
    },
  };

  return { linking, asked };
};
