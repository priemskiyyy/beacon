const claimed = new WeakSet<object>();

/**
 * Takes the exclusive use of a native manager, or answers `null` when another
 * session holds it. The release gives it back once; a second call does not
 * take it from whoever claimed it since.
 */
export const claimExclusive = (owner: object): (() => void) | null => {
  if (claimed.has(owner)) {
    return null;
  }

  claimed.add(owner);

  let held = true;

  return () => {
    if (!held) {
      return;
    }

    held = false;
    claimed.delete(owner);
  };
};
