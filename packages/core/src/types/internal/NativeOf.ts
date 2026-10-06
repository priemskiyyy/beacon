/** The native handle a route's mechanism or driver opens. */
export type NativeOf<TDefinition> = TDefinition extends {
  kind: "feed";
  mechanism: { open(...args: never[]): { native: infer TNative } };
}
  ? TNative
  : TDefinition extends {
        kind: "driver";
        driver: { open(...args: never[]): { native: infer TNative } };
      }
    ? TNative
    : never;
