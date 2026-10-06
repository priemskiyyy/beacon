import { CapabilitySection } from "src/components/Routes/CapabilitySection";
import { CheckSection } from "src/components/Routes/CheckSection";
import { NativeSection } from "src/components/Routes/NativeSection";
import { ObservationSection } from "src/components/Routes/ObservationSection";
import { OfferSection } from "src/components/Routes/OfferSection";
import { OperationSection } from "src/components/Routes/OperationSection";
import { PreparedSection } from "src/components/Routes/PreparedSection";
import { StateBadge } from "src/components/shared/StateBadge";
import { useObservableValue } from "src/hooks/useObservableValue";
import type { RouteView } from "src/types/internal/RouteView";

type RouteDetailProps = {
  view: RouteView;
  /** Off by default: a provider's handle must not show on a shared screen by accident. */
  showRaw: boolean;
  onClose: () => void;
};

/** The selected route: its observation with evidence, its offer, its check, its operation, what is prepared and what its commands declare. */
export const RouteDetail = (props: RouteDetailProps) => {
  const snapshot = useObservableValue(() => props.view.route.state);

  return (
    <section class="detail" aria-label="Selected route">
      <header class="detail-header">
        <code class="detail-name">{props.view.name}</code>
        <StateBadge state={snapshot().observation.status}>
          {snapshot().observation.status}
        </StateBadge>
        <small class="muted">snapshot {snapshot().revision}</small>
        <button
          type="button"
          class="icon-button detail-close"
          aria-label="Deselect route"
          onClick={() => props.onClose()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>
      <div class="detail-grid">
        <ObservationSection observation={snapshot().observation} />
        <OfferSection observation={snapshot().observation} />
        <CheckSection check={snapshot().check} />
        <OperationSection operation={snapshot().operation} />
        <PreparedSection prepared={snapshot().prepared} />
        <CapabilitySection capabilities={props.view.route.capabilities} />
        <NativeSection route={props.view.route} showRaw={props.showRaw} />
      </div>
    </section>
  );
};
