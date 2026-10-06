/**
 * How a caller reads a shared authority: joins the read in flight, or asks for
 * one after it, and how it stops waiting. One object stands for one call, so
 * what a call asks of an authority for several routes is one read.
 */
export type ReadOptions = {
  mode: "join" | "after-current";
  signal: AbortSignal | undefined;
};
