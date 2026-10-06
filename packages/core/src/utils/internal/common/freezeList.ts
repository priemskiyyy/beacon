// `Object.freeze` answers a readonly array type, and published types carry no
// readonly: the freeze is the guarantee, so the list keeps its own type.
export const freezeList = <TItem>(items: TItem[]): TItem[] => {
  Object.freeze(items);

  return items;
};
