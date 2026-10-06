/** @jsxImportSource react */
// Typechecked, never run: the wrapper takes the options of the inspector but the
// Beacon, which it reads from the provider that the application registered.
import { BeaconProvider, useBeacon } from "@priemskiyyy/beacon-react";
import type { RegisteredBeacon } from "@priemskiyyy/beacon-react";
import { expectTypeOf } from "vitest";

import type { LabBeacon } from "src/beacon.fixture";
import { BeaconDevtools } from "src/react";
import type { BeaconDevtoolsProps } from "src/react";
import type { BeaconDevtoolsOptions } from "src/types/BeaconDevtoolsOptions";

declare const beacon: LabBeacon;

// The wrapper is typed by what the application registered, as every hook of the binding is.
expectTypeOf<RegisteredBeacon>().toEqualTypeOf<LabBeacon>();

expectTypeOf<BeaconDevtoolsProps>().toEqualTypeOf<{
  initialIsOpen?: boolean;
  maxEvents?: number;
}>();

export const withoutProps = <BeaconDevtools />;

export const withProps = <BeaconDevtools initialIsOpen maxEvents={500} />;

export const insideTheProvider = (
  <BeaconProvider beacon={beacon} start>
    <BeaconDevtools initialIsOpen />
  </BeaconProvider>
);

// A wrapper reads the Beacon from its provider, so it takes none of its own.
// @ts-expect-error -- the Beacon comes from the nearest BeaconProvider, never from a prop.
export const withABeacon = <BeaconDevtools beacon={beacon} />;

// @ts-expect-error -- the number of events is a number.
export const withTextForACount = <BeaconDevtools maxEvents="many" />;

// @ts-expect-error -- the wrapper has no option the inspector does not have.
export const withAnotherOption = <BeaconDevtools position="right" />;

export const useProviderBeaconFits = () => {
  const options: BeaconDevtoolsOptions = { beacon: useBeacon() };

  return options;
};
