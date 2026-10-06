/**
 * A snapshot getter over a selection: the same value selects once, and a
 * selection equal to the last one keeps the last one's reference, so React
 * sees no change.
 */
export const createSelection = <TValue, TSelected>(
  read: () => TValue,
  selector: (value: TValue) => TSelected,
  isEqual: (previous: TSelected, next: TSelected) => boolean,
) => {
  let last: { value: TValue; selected: TSelected } | null = null;

  return (): TSelected => {
    const value = read();

    if (last === null) {
      last = { value, selected: selector(value) };

      return last.selected;
    }

    if (Object.is(last.value, value)) {
      return last.selected;
    }

    const selected = selector(value);

    last = {
      value,
      selected: isEqual(last.selected, selected) ? last.selected : selected,
    };

    return last.selected;
  };
};
