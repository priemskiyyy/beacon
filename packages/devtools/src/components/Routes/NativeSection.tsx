import { Show, createMemo } from "solid-js";

import { CopyButton } from "src/components/shared/CopyButton";
import { Section } from "src/components/shared/Section";
import { formatNative } from "src/formatting/formatNative";
import { useObservableValue } from "src/hooks/useObservableValue";
import type { ObservedRoute } from "src/types/internal/ObservedRoute";

type NativeSectionProps = {
  route: ObservedRoute;
  showRaw: boolean;
};

type NativeValueProps = { route: ObservedRoute };

const NativeValue = (props: NativeValueProps) => {
  const native = useObservableValue(() => props.route.native);
  // Once, so the copy button copies the text that is shown and the handle is walked once.
  const text = createMemo(() => formatNative(native()));

  return (
    <div class="context">
      <pre>{text()}</pre>
      <CopyButton text={text()} />
    </div>
  );
};

/** The provider's own handle. It is read, and even subscribed to, only while raw values are shown. */
export const NativeSection = (props: NativeSectionProps) => (
  <Section title="Native handle">
    <Show
      when={props.showRaw}
      fallback={
        <p class="muted">
          Hidden. Tick "Show raw values" to inspect the provider's handle.
        </p>
      }
    >
      <NativeValue route={props.route} />
    </Show>
  </Section>
);
