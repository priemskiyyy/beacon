/** A promise whose settling is in the hands of its owner. */
export const createDeferred = <TValue>() => {
  let resolve: (value: TValue) => void = () => {};

  const promise = new Promise<TValue>((fulfil) => {
    resolve = fulfil;
  });

  return { promise, resolve };
};
