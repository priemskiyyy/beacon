import { BeaconProvider, useObservable } from "@priemskiyyy/beacon-solid";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { Document } from "src/components/Document/Document";

type ApplicationProps = { lab: ReleaseLab };

export const Application: Component<ApplicationProps> = (props) => {
  const boot = useObservable(props.lab.boot);

  // A keyed Show builds a new tree for every document, as a page load would.
  return (
    <Show when={boot()} keyed>
      {(current) => (
        <BeaconProvider beacon={current.beacon}>
          <Document lab={props.lab} />
        </BeaconProvider>
      )}
    </Show>
  );
};
