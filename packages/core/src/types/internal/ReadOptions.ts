/** How a caller reads a shared authority: joins the read in flight, or asks for one after it, and how it stops waiting. */
export type ReadOptions = {
  mode: "join" | "after-current";
  signal: AbortSignal | undefined;
};
