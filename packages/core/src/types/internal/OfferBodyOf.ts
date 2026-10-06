import type { ObservationDraft } from "src/types/ObservationDraft";
import type { ReleaseSelection } from "src/types/ReleaseSelection";

/** What an offer of a route carries besides its reference. */
export type OfferBodyOf<TDefinition> = TDefinition extends {
  kind: "feed";
  select(...args: never[]): ReleaseSelection<infer TRelease>;
}
  ? { release: TRelease }
  : TDefinition extends {
        kind: "driver";
        driver: {
          open(...args: never[]): {
            check(...args: never[]): Promise<ObservationDraft<infer TOffer>>;
          };
        };
      }
    ? TOffer
    : never;
