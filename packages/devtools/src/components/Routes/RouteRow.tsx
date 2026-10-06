import { formatCheck } from "src/formatting/formatCheck";
import { formatOperation } from "src/formatting/formatOperation";
import { formatPrepared } from "src/formatting/formatPrepared";
import { useObservableValue } from "src/hooks/useObservableValue";
import type { RouteView } from "src/types/internal/RouteView";

type RouteRowProps = {
  view: RouteView;
  isSelected: boolean;
  onSelect: () => void;
};

/** One route in the sidebar: its observation, check, operation and prepared state, read from its snapshot alone. */
export const RouteRow = (props: RouteRowProps) => {
  const snapshot = useObservableValue(() => props.view.route.state);

  return (
    <button
      type="button"
      class="row"
      aria-pressed={props.isSelected}
      onClick={() => props.onSelect()}
    >
      <span class="row-name">
        <span class="dot" data-state={snapshot().observation.status} />
        <span class="row-title">{props.view.name}</span>
        <span class="row-status">{snapshot().observation.status}</span>
      </span>
      <small
        data-check={snapshot().check.state}
        data-operation={snapshot().operation.state}
      >
        check {formatCheck(snapshot().check)} · operation{" "}
        {formatOperation(snapshot().operation)} · prepared{" "}
        {formatPrepared(snapshot().prepared)}
      </small>
    </button>
  );
};
