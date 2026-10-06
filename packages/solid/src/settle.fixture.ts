// Lets every queued promise continuation run before the test goes on. It waits for no time to pass.
export const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
