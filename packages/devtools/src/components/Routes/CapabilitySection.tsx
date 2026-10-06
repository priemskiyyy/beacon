import { For, Show } from "solid-js";

import { Section } from "src/components/shared/Section";
import type { ObservedRoute } from "src/types/internal/ObservedRoute";
import { boundText } from "src/utils/boundText";

type CapabilitySectionProps = {
  capabilities: ObservedRoute["capabilities"];
};

/** What each command of the route declares, so a presentation can warn before it acts. Nothing here calls one. */
export const CapabilitySection = (props: CapabilitySectionProps) => (
  <Section title="Capabilities">
    <Show
      when={Object.keys(props.capabilities).length > 0}
      fallback={<p class="muted">No commands declared.</p>}
    >
      <ul class="list">
        <For each={Object.entries(props.capabilities)}>
          {([name, capability]) => (
            <li>
              <code>{boundText(name)}</code>
              <small>
                needs {capability.reference} · binding {capability.binding} ·
                impacts{" "}
                {capability.impacts.length === 0
                  ? "none"
                  : capability.impacts.join(", ")}
              </small>
            </li>
          )}
        </For>
      </ul>
    </Show>
  </Section>
);
